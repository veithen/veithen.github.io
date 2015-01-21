---
layout: post
title: "Improving the quality of Google Analytics data for Jekyll sites"
category: tech
tags:
 - Jekyll
 - Google Analytics
---

As explained in the [Google Analytics documentation][1], the default GA JavaScript snippet will extract the
information about the page location and title from `window.location` and `document.title`. This works fine
if the page is loaded directly from its origin without modification. However, a visitor of the site may
load the page from Google's cache or use a service such as Google Translate to display it in a different
language. In this case the `window.location` no longer contains the original URL of the page, and
`document.title` may have a modified value as well. On the other hand, the Google Analytics code contained
in the page will (in general) still be executed.

The end result is that this particular type of page view is still recorded, but with somewhat unexpected data,
as shown in the following screenshot:

![Google Analytics screenshot](/assets/2015-01-05-jekyll-improving-ga-data-quality/ga-screenshot.png)

The solution for this problem is to pass the page location and title information explicitly when sending the page view event.
Of course, for this to work these values must appear as constants in the JavaScript returned by the site.
With Jekyll this is easy to achieve because the location and title are available from the
`page.url` and `page.title` template parameters, so that they can be substituted when the HTML of the
page is generated. This is straightforward, except that care must be taken to correctly escape
quotes that may be part of the page title:

{% raw %}
~~~ javascript
ga('send', 'pageview', {
  'page': '{{ page.url }}',
  'title': '{{ page.title | replace: "'", "\\'" }}'
});
~~~
{% endraw %}

In the generated page these options will indeed appear as constants and they will be sent
unmodified to Analytics, even if the page is loaded from Google's cache or modified by
Google Translate:

~~~ javascript
ga('send', 'pageview', {
  'page': '{{ page.url }}',
  'title': '{{ page.title | replace: "'", "\\'" }}'
});
~~~

Note that this relies on the assumption that all pages have the `title` parameter set, i.e. that
the markup for the page title is always generated as follows:

{% raw %}
~~~ markup
<title>{{ page.title }}</title>
~~~
{% endraw %}

If that's not the case, then you need to implement the necessary changes to make things consistent, either
by modifying the JavaScript code or by changing the way the page metadata is generated.

Note that a side effect of the change described here is that the home page of the site will no
longer be reported as `/`, but as `/index.html`. In [another post][2] I explain why this is actually
desirable. In case you don't like this because it introduces a discontinuity in your analytics data,
it should be easy to modify the code shown above to take that particular situation into account.

[1]: https://developers.google.com/analytics/devguides/collection/analyticsjs/pages#implementation
[2]: /2015/01/05/jekyll-improving-ga-data-quality.html
