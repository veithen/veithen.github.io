---
layout: post
title: "Integrating Google Analytics with require.js"
category: tech
tags:
 - Google Analytics
 - RequireJS
updated: 2015-03-29
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
        "ga": "//www.google-analytics.com/analytics"
    },
    shim: {
        "ga": {
            exports: "__ga__"
        }
    }
});
~~~

The tracking code then needs to be replaced by the following code:

~~~ javascript
require(["ga"], function(ga) {
    ga("send", "pageview");
});
~~~

`require` will load `analytics.js` asynchronously and execute the callback function once the script has been loaded.
That piece of code therefore has the same asynchronicity properties as the original tracking code.

As noted in a [previous post][3], the user may have blocked Google Analytics using some privacy protection tool. If this
is the case, the code may fail in one of the following two ways:

*   The request for `analytics.js` is simply blocked and an RequireJS receives an error. The result is that `require`
    will not invoke the callback and the `ga` function is never called.

*   The request for `analytics.js` succeeds but is redirected, so that a different script is loaded. For example,
    recent versions of [Ghostery][5] intercept the request for `analytics.js` and return a redirect to a
    [data URI][6]:

    ![](ghostery-307.png)

    The replacement script encoded in the data URI doesn't redefine `window.__ga__` as expected, resulting in the
    following error:

        Uncaught TypeError: object is not a function

For page tracking, failure to execute the `ga` call is not an issue, but consider
the following function which is used to [track clicks on outbound links][3]:

~~~ javascript
var trackOutboundLink = function(url) {
    require(["ga"], function(ga) {
        ga("send", "event", "outbound", "click", url, {"hitCallback":
            function () {
                document.location = url;
            }
        });
    });
}
~~~

If Google Analytics is blocked, the hit callback is never executed and the outbound link will no longer work. To solve
this problem, the configuration shown at the beginning of this article needs to be modified as follows:

~~~ javascript
window.GoogleAnalyticsObject = "__ga__";
window.__ga__ = function() {
    for (var i=0; i<arguments.length; i++) {
        var arg = arguments[i];
        if (arg.constructor == Object && arg.hitCallback) {
            arg.hitCallback();
        }
    }
};
window.__ga__.q = [["create", "UA-XXXXXXXX-Y", "auto"]];
window.__ga__.l = Date.now();

require.config({
    paths: {
        "ga": [
            "//www.google-analytics.com/analytics",
            "data:application/javascript,"
        ]
    },
    shim: {
        "ga": {
            exports: "__ga__"
        }
    }
});
~~~

The modified code works as follows:

*   If `analytics.js` is loaded successfully (and unmodified), then that script will replace `window.__ga__` by its
    own function and Google Analytics will work as usual.

*   If the request for `analytics.js` fails, then require.js will attempt to load the module from the configured
    [fallback path][4], which is set to `"data:application/javascript,"`, i.e. a data URI representing an empty script
    (Note that the position of the comma is not a typo!). As a consequence, `window.__ga__` will not be replaced and
    the function defined at the beginning of the code will be used as a fallback implementation.

    That implementation takes care of executing the hit callback if one is supplied. This ensures that the
    `trackOutboundLink` function works as expected. Note that depending on the Google Analytics features your code uses
    and the assumptions that it makes about the `ga` function, you may need to complete that part of the code.

*   This leaves the scenario where the request for `analytics.js` is redirected and a different script is loaded.
    If that script doesn't replace `window.__ga__`, then the fallback implementation will be used, exactly as in the
    previous case. If it replaces `window.__ga__`, then it will (hopefully) do so with a function that executes any
    supplied hit callback.

## Note

After replacing the standard tracking code with the one suggested in this article, you will no longer
be able to use Google Analytics as an ownership verification method for Google Webmaster Tools. If your site is
currently verified using that method, reverification will eventually fail:

![Reverification failure](reverification-failure.png)

The solution is to switch to an alternate method, such as HTML file upload or adding a meta tag to the site's home page.

[1]: https://developers.google.com/analytics/devguides/collection/analyticsjs/#quickstart
[2]: http://requirejs.org/
[3]: /2015/01/24/outbound-link-tracking.html
[4]: http://requirejs.org/docs/api.html#pathsfallbacks
[5]: https://www.ghostery.com/
[6]: http://en.wikipedia.org/wiki/Data_URI_scheme
