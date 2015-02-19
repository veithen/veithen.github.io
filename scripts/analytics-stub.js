"use strict";

window[window.GoogleAnalyticsObject] = function() {
    for (var i=0; i<arguments.length; i++) {
        var arg = arguments[i];
        if (arg.constructor == Object && arg.hitCallback) {
            arg.hitCallback();
        }
    }
};
