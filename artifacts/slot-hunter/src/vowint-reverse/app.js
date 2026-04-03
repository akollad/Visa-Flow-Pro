// SOURCE: visaonweb.diplomatie.be — AngularJS app bootstrap
// Capturé le 2026-04-03 — RÉF: reverse engineering VOWINT pour bot CEV Kinshasa
// NOTES TECHNIQUES:
//   - App Angular nommée "osOnline"
//   - Dépendances: ngTable, ngResource, blueimp.fileupload, ui.select, ui.bootstrap, ui.mask
//   - Header X-Requested-With injecté globalement → à reproduire dans le bot
//   - Cache désactivé côté IE (header If-Modified-Since: 0) → utile pour le bot aussi
//   - ACTOR constants = les types d'acteurs dans une demande VOWINT

var app = angular.module('osOnline', [
    'ngTable',
    'ngResource',
    'blueimp.fileupload',
    'multi-select',
    //'ngBootstrap',
    'angular-flot',
    'ui.select',
    'ngSanitize',
    'ui.bootstrap',
    'ui.mask'
], function () {
});

app.run(['$rootScope', 'ACTOR', function ($rootScope, ACTOR) {
    $rootScope.ACTOR = ACTOR;

    //global range function
    $rootScope.getRange = function (from, to, numLength, onlyUnspecified) {
        var input = [];

        if (numLength == 6) {
            alert("aha");
        }

        if (onlyUnspecified) {
            input.push('00');
        }
        else {
            for (var i = from; i <= to; i += 1) {
                var formatnumber = pad(i, numLength);

                var item = new function () {
                    this.value = formatnumber;
                    if (formatnumber === '00') {
                        this.text = 'XX';
                    }
                    else {
                        this.text = formatnumber;
                    }
                }

                input.push(formatnumber);
            }
        }

        return input;
    };

    //padding leading 0 for dates
    function pad(n, width, z) {
        z = z || '0';
        n = n + '';
        return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
    };
}]);

//*******************       Config           *******************//

// NOTE BOT: $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest'
// → Toutes les requêtes AJAX VOWINT portent ce header. À reproduire impérativement.
app.config(['$httpProvider', 'uiSelectConfig', '$compileProvider', function ($httpProvider, uiSelectConfig, $compileProvider) {
    $httpProvider.defaults.headers.common["X-Requested-With"] = 'XMLHttpRequest';

    $httpProvider.defaults.cache = false;
    if (!$httpProvider.defaults.headers.get) {
        $httpProvider.defaults.headers.get = {};
    }
    // disable IE ajax request caching
    $httpProvider.defaults.headers.get['If-Modified-Since'] = '0';

    $httpProvider.interceptors.push('HttpErrorInterceptorModule');
    uiSelectConfig.theme = 'select2';

    // NOTE BOT: biomodapp = protocole custom pour biométrie. Pas pertinent pour le bot.
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|mailto|biomodappdev|biomodapptst|biomodappuat|biomodapp):/);
}]);

//*******************       Directives       *******************//

app.directive('repeatDone', [function () {
    return function (scope, element, attrs) {
        if (scope.$last) {
            $('.icheck').iCheck({
                checkboxClass: 'icheckbox_square-blue checkbox',
                radioClass: 'iradio_square-blue'
            });
        }
    };
}]);

app.directive('popover', [function () {
    return {
        restrict: 'A',
        link: function (scope, element, attrs) {
            $(element).popover();
        }
    };
}]);

app.directive('modalShow', [function () {
    return {
        restrict: "A",
        scope: {
            modalVisible: "="
        },
        link: function (scope, element, attrs) {
            scope.showLoading = function (visible) {
                if (visible) {
                    element.modal({ show: true, keyboard: false, backdrop: 'static' });
                }
                else {
                    element.modal("hide");
                }
            }
            if (!attrs.modalVisible) {
                scope.showLoading(false);
            }
            else {
                scope.$watch("modalVisible", function (newValue, oldValue) {
                    scope.showLoading(newValue);
                });
            }
        }
    }
}]);

app.directive('targetBlank', [function () {
    return {
        compile: function (element) {
            var elems = (element.prop("tagName") === 'A') ? element : element.find('a');
            elems.attr("target", "_blank");
        }
    };
}]);

app.factory('HttpErrorInterceptorModule', ['$q', 'messageService', function ($q, messageService) {
    return {
        response: function (response) {
            return response;
        },
        responseError: function (response) {
            if (response.status === 403) {
                messageService.sendErrorMessage('You have not enough permissions');
            }
            if (canRecover(response)) {
                return responseOrNewPromise
            }
            return $q.reject(response);
        }
    };
}]);

//*******************       Filters          *******************//

app.filter('jsonDate', ['$filter', function ($filter) {
    return function (input, format) {
        return $filter('date')(parseInt(input.substr(6)), format);
    };
}]);

//*******************       Constants        *******************//

// NOTE BOT: ACTOR.TYPES et ACTOR.SUBTYPES = IDs à envoyer dans les payloads
// Exemple: type=1 (Applicant) + subtype=1 (Demandeur de visa) pour le demandeur principal
app.constant('ACTOR', {
    TYPES: {
        APPLICANT: 1,           // Demandeur principal
        GUARDIAN: 2,            // Tuteur/parent
        OCCUPATION: 3,          // Employeur / école
        ACCOMODATION: 4,        // Hébergement
        REFERENCEPERSON: 5,     // Personne de référence (garant)
        REFERENCEORGANISATION: 6,
        EUFAMILYMEMBER: 7,      // Membre famille UE (si applicable)
    },
    SUBTYPES: {
        VISAAPPLICANT: 1,
        PARENTALAUTHORITY: 2,
        LEGALGUARDIAN: 3,
        OCCUPATIONEMPLOYER: 4,
        OCCUPATIONEDUCATIONALESTABLISHMENT: 5,
        HOTELORTEMPORARYACCOMODATION: 6,
        REFERENCEPERSON: 7,
        REFERENCECOMPANY: 8,
        REFERENCESCHOOL: 9,
        EUFAMILYMEMBER: 10
    }
});

app.value(
    "CONSTANTS", {
    DAYSINMONTH: 31,
    MONTHS: 12,
    YEARSFROM: 1900
})
