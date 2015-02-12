require.config({
    baseUrl: '/scripts',
    paths: {
        "jquery": "jquery.min",
        "jquery-ui": "jquery-ui.min",
        "chart": "Chart.min",
    }
});

window.GoogleAnalyticsObject = "__ga__";
window.__ga__ = {
    q: [["create", "UA-56790914-1", "auto"],
        ["set", "forceSSL", true]],
    l: Date.now()
};

define("ga", ["//www.google-analytics.com/analytics.js"], function() {
    return window.__ga__;
});
