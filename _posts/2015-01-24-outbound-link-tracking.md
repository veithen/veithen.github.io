---
layout: post
title: "Tracking outbound links with Google Analytics"
category: tech
tags:
 - Google Analytics
updated: 2015-01-26
---

The Google Analytics help has an [entry][1] that explains how to track clicks on outbound links. It uses the following
JavaScript function:

~~~ javascript
var trackOutboundLink = function(url) {
  ga('send', 'event', 'outbound', 'click', url, {'hitCallback':
    function () {
      document.location = url;
    }
  });
}
~~~

Links to be tracked need to be modified as follows:

~~~ markup
<a href="http://example.com" onclick="trackOutboundLink('http://example.com'); return false;">...</a>
~~~

The problem with this approach is that the visitor may have blocked Google Analytics using a privacy protection tool
such as [Ghostery][2]. In general, these tools don't block execution of the GA [tracking code][3] itself, but prevent
`analytics.js` from being loaded. This means that the `ga` function is defined, but tracking events pushed using that
function are not processed. In this case, the hit callback used by `trackOutboundLink` is never executed and clicking
on the link will have no effect. This is bad because it penalizes visitors who don't want to have their page views
tracked and makes your site appear broken for them.

Note that this problem only arises with tracking events that load a new page in the same window/tab, not with other types
of events. The reason is that loading a new page will stop JavaScript execution for the current page. In this case, it
is necessary to use a hit callback ensures that the new page is loaded after the tracking event has been processed. In
all other cases, it is safe to let the Google Analytics code process the event asynchronously.

To support visitors who use privacy tools we need to find a way to detect whether Google Analytics has been blocked or
not. As shown [here][4], the `ga` function defined by the tracking code creates a JavaScript array `ga.q` (if it doesn't
exist yet) and then pushes its arguments onto that array. Once `analytics.js` is loaded, it processes the queued events
and replaces `ga` by a completely different function, so that `ga.q` is no longer defined. During page load at least two
items are added to the queue, one to create the tracker and another one to record the page view. This means that `ga.q`
is defined only if the tracking code has been executed, but `analytics.js` has not been loaded yet. This means that it
is possible to determine if Google Analytics is blocked simply by checking if `ga.q` is defined:

~~~ javascript
var trackOutboundLink = function(url) {
  if (ga.q) {
    // Google Analytics is blocked
    document.location = url;
  } else {
    ga('send', 'event', 'outbound', 'click', url, {'hitCallback':
      function () {
        document.location = url;
      }
    });
  }
}
~~~

Note that it is safe to assume that this code will continue to work as expected even if Google decides to make changes
to `analytics.js`. The reason is that `ga.q` is set by the `ga` function defined by the tracking code embedded in your
site's pages and that code can't be changed unilaterally by Google.

Another option is to check `ga.loaded` as described [here][6]. Note that this doesn't appear to be documented anywhere
in the Google Analytics documentation, although it is indeed used in a [recently added example][7].

The other drawback of the approach described in the Google Analytics help is that the way links need to be modified
isn't particularly elegant. Instead of having to add an `onclick` attribute to every tracked link one would probably
prefer a solution that only requires adding a style class:

~~~ markup
<a href="http://example.com" class="tracked">...</a>
~~~

With [jQuery][5] this is easy to implement:

~~~ javascript
$(function() {
  $("a.tracked").click(function(e) {
    if (!ga.q) {
      var url = $(this).attr("href");
      ga('send', 'event', 'outbound', 'click', url, {'hitCallback':
        function () {
          document.location = url;
        }
      });
      e.preventDefault();
    }
  });
});
~~~

[1]: https://support.google.com/analytics/answer/1136920
[2]: https://www.ghostery.com/
[3]: https://developers.google.com/analytics/devguides/collection/analyticsjs/#quickstart
[4]: http://code.stephenmorley.org/javascript/understanding-the-google-analytics-tracking-code/
[5]: http://jquery.com/
[6]: https://www.domsammut.com/code/workaround-for-when-the-hitcallback-function-does-not-receive-a-response-analytics-js
[7]: https://developers.google.com/analytics/devguides/collection/analyticsjs/enhanced-ecommerce#product-click
