import { useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useCreateApplication, getListApplicationsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, CheckCircle2, Plane, MapPin } from "lucide-react";

const schema = z.object({
  destination: z.enum(["usa", "dubai", "turkey", "india"]),
  visaType: z.string().min(1, "Type de visa requis"),
  applicantName: z.string().min(2, "Nom du demandeur requis"),
  passportNumber: z.string().min(5, "Numéro de passeport requis"),
  travelDate: z.string().min(1, "Date de voyage requise"),
  returnDate: z.string().optional(),
  purpose: z.string().min(10, "Veuillez détailler le motif de votre voyage"),
  notes: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const VISA_TYPES = {
  usa: ["B1/B2 (Tourisme/Affaires)", "F1 (Étudiant)", "K1 (Fiancé(e))", "H1B (Travail)", "J1 (Échange)"],
  dubai: ["Touriste 30j", "Touriste 60j", "Résidence", "Affaires"],
  turkey: ["Touriste", "Affaires", "Étudiant"],
  india: ["e-Visa Touriste", "Affaires", "Médical"],
};

const DESTINATIONS = [
  { id: "usa", name: "États-Unis", desc: "Visas non-immigrants et immigrants" },
  { id: "dubai", name: "Dubaï (EAU)", desc: "Visas touristiques et résidents" },
  { id: "turkey", name: "Turquie", desc: "E-Visa et consulaire" },
  { id: "india", name: "Inde", desc: "Visas électroniques et standards" },
];

export default function NewApplication() {
  const [step, setStep] = useState(1);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      destination: undefined,
      visaType: "",
      applicantName: "",
      passportNumber: "",
      travelDate: "",
      returnDate: "",
      purpose: "",
      notes: "",
    },
  });

  const selectedDest = form.watch("destination");

  const mutation = useCreateApplication({
    mutation: {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: getListApplicationsQueryKey() });
        toast({ title: "Dossier créé", description: "Votre demande a été enregistrée avec succès." });
        setLocation(`/dashboard/applications/${data.id}`);
      },
      onError: () => {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de créer le dossier." });
      }
    }
  });

  const onSubmit = (data: FormValues) => {
    mutation.mutate({ data: data as any });
  };

  const nextStep = async () => {
    let fieldsToValidate: (keyof FormValues)[] = [];
    if (step === 1) fieldsToValidate = ["destination", "visaType"];
    if (step === 2) fieldsToValidate = ["applicantName", "passportNumber", "travelDate", "purpose"];
    
    const isValid = await form.trigger(fieldsToValidate);
    if (isValid) setStep(step + 1);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-serif font-bold text-primary">Nouveau Dossier</h1>
          <p className="text-muted-foreground mt-1">Étape {step} sur 3</p>
        </div>
      </div>

      <div className="flex gap-2 mb-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`h-2 rounded-full flex-1 transition-colors ${i <= step ? 'bg-secondary' : 'bg-slate-200'}`} />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            
            {/* STEP 1 */}
            <div className={step === 1 ? "block space-y-6" : "hidden"}>
              <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-secondary" /> Choix de la destination
              </h2>
              
              <FormField
                control={form.control}
                name="destination"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Où souhaitez-vous aller ?</FormLabel>
                    <FormControl>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-2">
                        {DESTINATIONS.map((dest) => (
                          <div 
                            key={dest.id}
                            onClick={() => {
                              field.onChange(dest.id);
                              form.setValue("visaType", ""); // reset visa type on dest change
                            }}
                            className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                              field.value === dest.id 
                                ? "border-secondary bg-yellow-50/50" 
                                : "border-border hover:border-primary/20"
                            }`}
                          >
                            <div className="font-bold text-primary">{dest.name}</div>
                            <div className="text-sm text-muted-foreground mt-1">{dest.desc}</div>
                          </div>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {selectedDest && (
                <FormField
                  control={form.control}
                  name="visaType"
                  render={({ field }) => (
                    <FormItem className="animate-in fade-in slide-in-from-top-4">
                      <FormLabel>Type de Visa</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Sélectionnez le type de visa..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(VISA_TYPES[selectedDest as keyof typeof VISA_TYPES] || []).map((type) => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>

            {/* STEP 2 */}
            <div className={step === 2 ? "block space-y-6" : "hidden"}>
              <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <Plane className="w-5 h-5 text-secondary" /> Informations du voyageur
              </h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="applicantName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom complet tel que sur le passeport</FormLabel>
                      <FormControl>
                        <Input placeholder="Jean Dupont" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="passportNumber"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Numéro de passeport</FormLabel>
                      <FormControl>
                        <Input placeholder="OBXXXXXX" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="travelDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de départ prévue</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="returnDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date de retour (Optionnel)</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="h-12" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="purpose"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Motif détaillé du voyage</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Expliquez brièvement pourquoi vous souhaitez voyager..." {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* STEP 3 */}
            <div className={step === 3 ? "block space-y-6" : "hidden"}>
              <h2 className="text-xl font-bold text-primary mb-4 flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-secondary" /> Vérification et Notes
              </h2>
              
              <div className="bg-slate-50 p-6 rounded-xl border border-border mb-6 text-sm">
                <p className="mb-2"><strong>Destination:</strong> {selectedDest?.toUpperCase()}</p>
                <p className="mb-2"><strong>Visa:</strong> {form.watch("visaType")}</p>
                <p className="mb-2"><strong>Demandeur:</strong> {form.watch("applicantName")}</p>
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes supplémentaires (Optionnel)</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Des détails importants à nous communiquer sur votre dossier ?" {...field} rows={4} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-border">
              {step > 1 ? (
                <Button type="button" variant="outline" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="w-4 h-4 mr-2" /> Retour
                </Button>
              ) : <div></div>}

              {step < 3 ? (
                <Button type="button" onClick={nextStep} className="bg-primary px-8">
                  Suivant <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={mutation.isPending} className="bg-secondary text-primary hover:bg-yellow-500 font-bold px-8">
                  {mutation.isPending ? "Création..." : "Soumettre le dossier"}
                </Button>
              )}
            </div>

          </form>
        </Form>
      </div>
    </div>
  );
}
