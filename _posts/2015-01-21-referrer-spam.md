---
layout: post
title: "Understanding and eliminating referrer spam in Google Analytics"
category: tech
tags:
 - Google Analytics
scripts:
 - /assets/2015-01-21-referrer-spam/ga.js
image: /assets/2015-01-21-referrer-spam/referrer-spam.png
updated: 2015-03-12
description: >
 If you are using Google Analytics you may have noticed page views with referrals from ilovevitaly.com, darodar.com,
 priceg.com, blackhatworth.com, o-o-6-o-o.com and other suspicious domains appearing in your statistics. This is so
 called referrer spam. This article describes in depth how referrer spam works and debunks some common misconceptions
 about it. It also discusses possible solutions, include solutions that have been proposed elsewhere as well as an
 alternative solution that is more robust.
---

{:nofollow: rel="nofollow"}

## Introduction

If you are using Google Analytics you may have noticed page views with referrals from `ilovevitaly.com`, `darodar.com`,
`priceg.com`, `blackhatworth.com`, `o-o-6-o-o.com` and other suspicious domains appearing in your statistics:

![Referrer spam in Google Analytics]({{ page.image }})

This is so called *referrer spam*. What is characteristic for these spam requests is that they are reported with fake
page titles...

![Fake page titles](/assets/2015-01-21-referrer-spam/fake-pagetitles.png)

...as well as fake host names:

![Fake host names](/assets/2015-01-21-referrer-spam/fake-hostnames.png)

We will see later why this is so. The purpose of this spam is to trick webmasters into visiting the sites reported as
referrers. Wiyre has published an interesting [infographic][wiyre] that explains how this generates revenue for the
spammer. Note however that the technical explanation given in that infographic is not entirely accurate, as we will show
later.

It is important to distinguish referrer spam from another form of nuisance, namely bots that automatically crawl your
site and that leave similar traces in your analytics data. The typical example for this is the
[Semalt crawler][semalt]{:nofollow}. Producing entries in your site's referrer list is (probably) not their primary
purpose, but they do so as a side effect. They can be distinguished by the fact that page titles and hostnames are
reported correctly.

In the present article I will not discuss bots any further and focus only on genuine referrer spam.
In particular I would like to address two
things. First, I will describe in depth how referrer spam works and try to debunk some common misconceptions about it.
Then I will discuss possible solutions for that problem. This includes solutions that have been proposed elsewhere as
well as an alternative solution that I find more robust.

## How referrer spam works

To show how referrer spam works, we first need to examine how page views are reported to Google Analytics. When a page
is loaded, the [tracking code][tracking-code] will send a GET request to `http://www.google-analytics.com/collect` to
record the page view. The exact protocol is described in the [Measurement Protocol Reference][protocol-reference], but
here we are only interested in the minimal set of query parameters that need to be provided for the page tracking
request to succeed. This is described in the [Developer Guide][page-tracking-request]:

~~~
v=1             // Version.
&tid=UA-XXXX-Y  // Tracking ID / Property ID.
&cid=555        // Anonymous Client ID.
&t=pageview     // Pageview hit type.
&dh=mydemo.com  // Document hostname.
&dp=/home       // Page.
&dt=homepage    // Title.
~~~

It is obviously very easy to spoof this kind of request, i.e. to send Google Analytics a page view report that doesn't
correspond to an actual page impression (and not even an actual request to the site). The only information one needs to
know is the Property ID, but that information can easily be extracted from the tracking code embedded in any of the
pages of the target site:

~~~ markup
<script>
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
(i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-XXXX-Y', 'auto');
ga('send', 'pageview');
</script>
~~~

You can test this with the following form. Enter the ID of a Web property you have access to and choose an arbitrary
hostname, page and title. After submitting the form, you should see a page view being reported for that Web property
in Google Analytics. Note that a random client ID is generated for each request, so that these page views will be
reported as different user sessions. The full JavaScript code that processes the form and sends the request to Google
Analytics can be found [here]({{ page.scripts[0] }}).

---

<form class="form-horizontal">
  <div class="form-group">
    <label for="tid" class="col-sm-2 control-label">Property ID</label>
    <div class="col-sm-10">
      <input type="text" class="form-control" name="tid" placeholder="UA-XXXXXXXX-Y">
    </div>
  </div>
  <div class="form-group">
    <label for="dh" class="col-sm-2 control-label">Hostname</label>
    <div class="col-sm-10">
      <input type="text" class="form-control" name="dh" placeholder="www.example.org">
    </div>
  </div>
  <div class="form-group">
    <label for="dp" class="col-sm-2 control-label">Page</label>
    <div class="col-sm-10">
      <input type="text" class="form-control" name="dp" placeholder="/somepage.html">
    </div>
  </div>
  <div class="form-group">
    <label for="dt" class="col-sm-2 control-label">Title</label>
    <div class="col-sm-10">
      <input type="text" class="form-control" name="dt" placeholder="Some page">
    </div>
  </div>
  <div class="form-group">
    <div class="col-sm-offset-2 col-sm-10">
      <button type="submit" class="btn btn-primary">Submit</button>
    </div>
  </div>
</form>

---

This is what you should see appear in the real-time overview in Google Analytics after submitting the form:

![Fake page view](/assets/2015-01-21-referrer-spam/fake-pageview.png)

There are two important lessons to be learned from this exercise that should help to overcome some misconceptions about
referrer spam:

* Generating referrer spam doesn't require any kind of intrusion into your Web site or your Google Analytics account.
  The only information that the spammer needs is the property ID. That information is public because it can be
  extracted from any Web page on your site. However, the spammer actually doesn't even need to do that: he can simply
  try random property IDs. Given the structure
  of the ID, there is indeed a significant probability of hitting an existing property by choosing an ID randomly.
  This obviously means that the spammer neither knows the domain name corresponding to the property nor the page titles.
  That's the reason why referrer spam is reported with fake hastnames and page titles, as observed in the introduction.

* Once the spammer has guessed the property ID, he can generate page views in Google Analytics without
  sending requests to the actual Web site. This implies that there is no way to prevent this type of spam by
  implementing changes to the site (e.g. to the JavaScript in the Web pages or the `.htaccess` file).

## The impact of referrer spam

Obviously the primary impact of referrer spam is that it decreases the accuracy of your analytics data. Some webmasters
are also worried that this would have a negative impact on their site's search ranking. However, this is not the case:
[Google Analytics data is not used in any way for search ranking][ga-ranking].

## How to prevent referrer spam

A [common recommendation][referral-filter] to prevent this type of referrer spam in Google Analytics is to eliminate the
fake page views by creating a filter that uses a criteria based on the referral. However, this approach is ineffective
because the referrals used by the spammers will change over time and you would have to update your filters on a regular
basis.

Another approach that has been [suggested][hostname-filter] is to use filters based on hostnames. As we have seen
earlier, since the spammers simply try random property IDs, they don't know the hostname of the Web site corresponding
to a Web property they sent spam to. This means that it is possible to filter out the fake page
views by configuring a whitelist of legitimate hostnames.
The drawback of this approach is that it is easy to accidentally filter out valid page views. E.g. if somebody views
a page of your site through Google Translate, this will be reported as a page view with hostname
`translate.googleusercontent.com`. If you want to preserve these page views, then all relevant hostnames need to be
included in the whitelist, which may be tricky.

In this article, I propose another approach that relies on the simple observation that all referrer spam is reported
for the home page of the site (i.e. with request URI `/`). On the other hand, as explained in the
[Google Analytics documentation][overriding], it is possible to override the reported page URI in the JavaScript
snippet:

~~~ javascript
ga('send', 'pageview', '/my-overridden-page?id=1');
~~~

The idea is to modify the home page such that instead of reporting `/` as request URI, it uses `/index.html` (or
`/index.php` or whatever the name of your index page is):

~~~ javascript
ga('send', 'pageview', '/index.html');
~~~

With that change, you can safely eliminate referrer spam by creating a filter that excludes all page views with
request URI `/`, because that URI will no longer be reported in legitimate page views:

![Referrer spam filter](/assets/2015-01-21-referrer-spam/filter.png)

**Note:** If you are using Jekyll to generate your site, you may want to have a look at
[one of my previous articles][previous-post] that discusses another modification to the Google Analytics snippet that
actually has the `/` &rarr; `/index.html` change as a side effect.

## Limitations of the request URI filtering approach

As mentioned in my earlier article linked in the note above, replacing `/` with `/index.html` in the reported pageviews
will introduce a discontinuity in your analytics data. If that is not acceptable, then you should use a different
method to eliminate referrer spam.

It has also been argued that since the request URI in the page views reported to Google Analytics can also be forged,
the method suggested here can easily be circumvented by targetting pages other than `/`. However, since spammers don't
know anything about the structure of the targeted Web site, they would necessarily have to send page view reports for
non existing pages. These fake pages would show up in the "All Pages" and "Landing Pages" reports and would immediately
give a hint that something suspicious is going on. This would probably decrease the likelihood that the fake referrer
URLs linked to these suspicous page views are clicked (even by inexperienced Google Analytics users),
i.e. reduce the effectiveness of the referrer
spam. It is therefore unlikely that spammers would actually do this (unless of course a huge number of webmasters start
using the request URI filtering approach and spammers are forced to adapt their strategy...).

In the event that spammers indeed start targetting pages other than `/`, there is actually another slightly
more complicated approach that would eliminate that type of spam as well. The idea is to create a custom dimension and
change the tracking code to always send a specific value for that custom dimension in all page views. Referrer spam can
then be filtered out using a criteria based on that custom dimension.

Note that even that approach is not entirely watertight. For a sophisticated spammer it would not be too difficult to
render pages in a headless browser and intercept the requests sent to Google Analytics. That would make the referrer
spam completely indistinguishable from legitimate page views. However, this would not work for randomly chosen property
IDs and the spammer would have to crawl the Web to find public pages that use Google Analytics.

[tracking-code]: https://developers.google.com/analytics/devguides/collection/analyticsjs/#quickstart
[protocol-reference]: https://developers.google.com/analytics/devguides/collection/protocol/v1/reference
[page-tracking-request]: https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide#page
[hostname-filter]: http://www.analyticsedge.com/2014/12/removing-referral-spam-google-analytics/
[overriding]: https://developers.google.com/analytics/devguides/collection/analyticsjs/pages#overriding
[previous-post]: /2015/01/05/jekyll-improving-ga-data-quality.html
[referral-filter]: http://www.jeffalytics.com/8-steps-eliminating-bad-data-google-analytics/
[wiyre]: https://plus.google.com/+Wiyrewebsite/posts/Bhd259DXjj4
[semalt]: http://semalt.com/project_crawler.php
[ga-ranking]: https://www.youtube.com/watch?v=CgBw9tbAQhU
