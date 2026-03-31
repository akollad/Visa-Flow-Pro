import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { Id } from "@convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Star, X, CheckCircle2, MessageSquareHeart } from "lucide-react";

interface ReviewModalProps {
  applicationId: Id<"applications">;
  destination: string;
  onClose: () => void;
}

export function ReviewModal({ applicationId, destination, onClose }: ReviewModalProps) {
  const { toast } = useToast();
  const submitReview = useMutation(api.reviews.submit);
  const existingReview = useQuery(api.reviews.getForApplication, { applicationId });

  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [city, setCity] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (existingReview !== undefined && existingReview !== null && !submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-primary mb-2">Avis déjà soumis</h3>
          <p className="text-muted-foreground mb-6">
            Merci pour votre retour ! Votre avis sera publié après validation par notre équipe.
          </p>
          <Button onClick={onClose} className="w-full bg-primary text-white">Fermer</Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-primary mb-2">Merci pour votre avis !</h3>
          <p className="text-muted-foreground mb-6">
            Votre témoignage sera publié sur la landing page après validation par notre équipe. Nous apprécions votre confiance.
          </p>
          <Button onClick={onClose} className="w-full bg-primary text-white">Fermer</Button>
        </div>
      </div>
    );
  }

  async function handleSubmit() {
    if (rating === 0) {
      toast({ title: "Choisissez une note", variant: "destructive" });
      return;
    }
    if (!displayName.trim()) {
      toast({ title: "Entrez votre prénom", variant: "destructive" });
      return;
    }
    if (!city.trim()) {
      toast({ title: "Entrez votre ville", variant: "destructive" });
      return;
    }
    if (comment.trim().length < 10) {
      toast({ title: "Avis trop court (10 caractères minimum)", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await submitReview({
        applicationId,
        displayName: displayName.trim(),
        city: city.trim(),
        destination,
        rating,
        comment: comment.trim(),
      });
      setSubmitted(true);
    } catch (err: unknown) {
      toast({
        title: "Erreur",
        description: err instanceof Error ? err.message : "Une erreur est survenue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const STAR_LABELS = ["", "Décevant", "Passable", "Bien", "Très bien", "Excellent !"];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl flex flex-col max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center">
              <MessageSquareHeart className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-primary">Donnez votre avis</h3>
              <p className="text-xs text-muted-foreground">Votre expérience aide d'autres voyageurs</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="bg-muted rounded-xl p-4 text-sm text-muted-foreground">
            🎉 Félicitations pour votre dossier <span className="font-semibold text-primary">{destination}</span> ! Partagez votre expérience avec Joventy.
          </div>

          <div className="text-center">
            <p className="text-sm font-medium text-primary mb-3">Quelle est votre note globale ?</p>
            <div className="flex items-center justify-center gap-2 mb-2">
              {[1, 2, 3, 4, 5].map((s) => (
                <button
                  key={s}
                  onMouseEnter={() => setHovered(s)}
                  onMouseLeave={() => setHovered(0)}
                  onClick={() => setRating(s)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-9 h-9 transition-colors ${
                      s <= (hovered || rating)
                        ? "text-secondary fill-secondary"
                        : "text-border"
                    }`}
                  />
                </button>
              ))}
            </div>
            {(hovered || rating) > 0 && (
              <p className="text-sm font-semibold text-secondary">{STAR_LABELS[hovered || rating]}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Prénom & Initial *
              </label>
              <Input
                placeholder="Ex : Christophe M."
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
                Ville *
              </label>
              <Input
                placeholder="Ex : Kinshasa"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                maxLength={40}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Votre témoignage *
            </label>
            <Textarea
              placeholder="Partagez votre expérience avec Joventy... (comment ça s'est passé, délais, qualité du service)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={4}
              maxLength={600}
              className="resize-none"
            />
            <p className="text-[11px] text-muted-foreground mt-1 text-right">{comment.length}/600</p>
          </div>

          <p className="text-[11px] text-muted-foreground">
            * Votre avis sera relu par notre équipe avant d'apparaître sur la landing page. Aucune information personnelle sensible n'est publiée.
          </p>
        </div>

        <div className="p-6 pt-0 flex gap-3">
          <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
            Plus tard
          </Button>
          <Button onClick={handleSubmit} className="flex-1 bg-secondary hover:bg-orange-500 text-primary font-bold" disabled={loading}>
            {loading ? "Envoi…" : "Envoyer mon avis"}
          </Button>
        </div>
      </div>
    </div>
  );
}
