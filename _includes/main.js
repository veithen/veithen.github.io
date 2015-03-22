window.GoogleAnalyticsObject = "__ga__";
window.__ga__ = {
    q: [["create", "UA-56790914-1", "auto"],
        ["set", "forceSSL", true]],
    l: Date.now()
};

require.config({
    baseUrl: '/scripts',
    paths: {
        "jquery": [
            "//ajax.googleapis.com/ajax/libs/jquery/2.1.3/jquery.min",
            "jquery.min"
        ],
        "jquery-ui": [
            "//ajax.googleapis.com/ajax/libs/jqueryui/1.11.2/jquery-ui.min",
            "jquery-ui.min"
        ],
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
        "prism": {
            exports: "Prism"
        }
    }
});

require(["jquery"], function($) {
    $(function() {
        $("article a").each(function() {
            var url = $(this).attr("href");
            if (url.indexOf("http://") == 0 || url.indexOf("https://") == 0) {
                $(this).click(function(e) {
                    require(["ga"], function(ga) {
                        ga('send', 'event', 'outbound', 'click', url, {'hitCallback':
                            function () {
                                document.location = url;
                            }
                        });
                    });
                    e.preventDefault();
                });
            }
        });
    });
});
