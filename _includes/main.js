window.GoogleAnalyticsObject = "__ga__";
window.__ga__ = {
    q: [["create", "UA-56790914-1", "auto"],
        ["set", "forceSSL", true]],
    l: Date.now()
};

require.config({
    baseUrl: '/scripts',
    paths: {
        "jquery": "jquery.min",
        "jquery-ui": "jquery-ui.min",
        "chart": "Chart.min",
        "ga": localStorage.dontTrack ? "analytics-stub" : [
            "//www.google-analytics.com/analytics",
            "analytics-stub"
        ],
    },
    shim: {
        "ga": {
            exports: "__ga__"
        },
    }
});
