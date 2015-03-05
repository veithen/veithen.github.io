---
layout: post
title: "Integrating Google Analytics with require.js"
category: tech
tags:
 - Google Analytics
updated: 2015-02-18
disqus: true
description: Learn how to integrate Google Analytics with require.js.
---

The Google Analytics [tracking code][1] loads `analytics.js` asynchronously. [require.js][2] also loads modules
asynchronously. If you are using that framework, it makes sense to let require.js load `analytics.js` instead of using
the traditional tracking code. This can be easily achieved with the following configuration:

~~~ javascript
window.GoogleAnalyticsObject = "__ga__";
window.__ga__ = {
    q: [["create", "UA-XXXXXXXX-Y", "auto"]],
    l: Date.now()
};

require.config({
    paths: {
        "ga": "//www.google-analytics.com/analytics",
    },
    shim: {
        "ga": {
            exports: "__ga__"
        },
    }
});
~~~

The tracking code then needs to be replaced by the following code:

~~~ javascript
require(['ga'], function(ga) {
    ga('send', 'pageview');
});
~~~

`require` will load `analytics.js` asynchronously and execute the callback function once the script has been loaded.
That piece of code therefore has the same asynchronicity properties as the original tracking code.

As noted in a [previous post][3], the user may have blocked Google Analytics in which case loading `analytics.js` fails.
The consequence is that the require callback is never executed. For page tracking, this is not an issue, but consider
the following function which is used to [track clicks on outbound links][3]:

~~~ javascript
var trackOutboundLink = function(url) {
    require(['ga'], function(ga) {
        ga('send', 'event', 'outbound', 'click', url, {'hitCallback':
            function () {
                document.location = url;
            }
        });
    });
}
~~~

If Google Analytics is blocked, the call to the `ga` function is never executed and the outbound link will no longer
work. To work around this, we can use a [fallback path][4] to instruct require.js to load an alternate script if
loading `analytics.js` fails. To do this, the configuration shown at the beginning of this article needs to be
modified as follows:

~~~ javascript
window.GoogleAnalyticsObject = "__ga__";
window.__ga__ = {
    q: [["create", "UA-XXXXXXXX-Y", "auto"]],
    l: Date.now()
};

require.config({
    paths: {
        "ga": [
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
~~~

The `analytics-stub.js` script then needs to define a dummy `ga` function, as shown below:

~~~ javascript
window[window.GoogleAnalyticsObject] = function() {
    for (var i=0; i<arguments.length; i++) {
        var arg = arguments[i];
        if (arg.constructor == Object && arg.hitCallback) {
            arg.hitCallback();
        }
    }
}
~~~

That implementation takes care of executing the hit callback if one is supplied. This ensures that the
`trackOutboundLink` function works as expected. Depending on the Google Analytics features your code uses and the
assumptions that it makes about the `ga` function, you may need to complete the above code.

[1]: https://developers.google.com/analytics/devguides/collection/analyticsjs/#quickstart
[2]: http://requirejs.org/
[3]: /2015/01/24/outbound-link-tracking.html
[4]: http://requirejs.org/docs/api.html#pathsfallbacks
