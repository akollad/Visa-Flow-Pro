// SOURCE: visaonweb.diplomatie.be — messageService + loadingContainer directive
// Capturé le 2026-04-03
// NOTE BOT: Ce service n'est pas pertinent pour l'automatisation.
// Utilisé uniquement pour afficher des notifications toast dans l'interface.
// Répertorié pour complétion du reverse engineering.

(function () {
    'use strict';

    angular
        .module('osOnline')
        .directive('loadingContainer', loadingContainer);

    function loadingContainer() {
        var directive = {
            link: link,
            restrict: 'A',
            scope: false
        };
        return directive;

        function link(scope, element, attrs) {
            var loadingLayer = angular.element('<div class="loading"></div>');
            element.append(loadingLayer);
            element.addClass('loading-container');
            scope.$watch(attrs.loadingContainer, function (value) {
                loadingLayer.toggleClass('ng-hide', !value);
            });
        }
    }
})();

// NOTE BOT: messageService = notifications toast via jQuery Gritter
// Pas pertinent pour le bot — ignoré
app.service('messageService', [function () {
    this.sendErrorMessage = function (message) {
        $.gritter.add({ position: 'bottom-right', text: message, class_name: 'danger' });
    };
    this.sendInfoMessage = function (message) {
        $.gritter.add({ position: 'bottom-right', text: message, class_name: 'info' });
    };
    this.sendWarningMessage = function (message) {
        $.gritter.add({ position: 'bottom-right', text: message, class_name: 'warning' });
    };
    this.sendSuccessMessage = function (message) {
        $.gritter.add({ position: 'bottom-right', text: message, class_name: 'success' });
    };
}]);
