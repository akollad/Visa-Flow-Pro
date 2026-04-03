// SOURCE: visaonweb.diplomatie.be — AngularJS commonController
// Capturé le 2026-04-03 — RÉF: reverse engineering VOWINT pour bot CEV Kinshasa
// NOTES TECHNIQUES:
//   - Gère la navigation, le menu latéral, la langue de l'URL
//   - baseUrl construit dynamiquement selon /fr/, /nl/, /en/ dans l'URL
//   - Endpoint SetSessionVariable: POST /Common/SetSessionVariable
//   - GdprApproval: 1=court séjour, 2=long séjour (impacte le formulaire)
//   - messageService = service de notification global de l'app

app.controller('commonController', ['$scope', '$http', 'messageService', function ($scope, $http, messageService) {
    $scope.isLoading = true;
    $scope.UserDataHandler = null;
    $scope.baseUrl = window.location.host;
    var language = document.documentElement.lang;

    // NOTE BOT: Le bot doit toujours cibler le préfixe /fr/ (langue française)
    // baseUrl résultant: visaonweb.diplomatie.be/fr/
    if (window.location.href.indexOf('/fr-BE/') != -1 || window.location.href.indexOf('/fr') != -1) {
        $scope.baseUrl = $scope.baseUrl + '/fr/';
    }
    if (window.location.href.indexOf('/nl-BE/') != -1 || window.location.href.indexOf('/nl') != -1) {
        $scope.baseUrl = $scope.baseUrl + '/nl/';
    }
    if (window.location.href.indexOf('/en-UK/') != -1 || window.location.href.indexOf('/en') != -1) {
        $scope.baseUrl = $scope.baseUrl + '/en/';
    }

    // NOTE BOT: URLs GDPR — à appeler selon le type de visa
    // gdprApproval=1 → Court séjour Schengen (C) ← notre cas CEV
    // gdprApproval=2 → Long séjour
    $scope.GdprShortStayUrl = 'https://' + $scope.baseUrl + 'VisaApplication/PrintGdpr?gdprApproval=1';
    $scope.GdprLongStayUrl = 'https://' + $scope.baseUrl + 'VisaApplication/PrintGdpr?gdprApproval=2';
    $scope.GdprUrl = $scope.baseUrl;

    $scope.urlEncode = function (target) {
        return encodeURIComponent(target);
    }

    // NOTE BOT: Endpoint menu — non pertinent pour le bot, ignoré
    $scope.ToggleSideMenu = function () {
        var w = $("#cl-wrapper");
        var collapsed = 'True';
        if (w.hasClass("sb-collapsed")) { collapsed = 'False'; }
        $http({
            method: 'POST', url: '/Common/SetSessionVariable', data: {
                sessionVariable: "CollapsedMenu",
                value: collapsed
            }
        }).
        success(function (data, status) {
            //alert("ok");
        }).
        error(function (data, status) {
            //alert("error");
        });
    };

    $scope.redirectToGoogle = function () {
        $window.open('https://www.google.com', '_blank');
    };

    $scope.messageService = messageService;
}]);
