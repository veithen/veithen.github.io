---
layout: post
title: "Understanding and eliminating referrer spam in Google Analytics"
category: tech
tags:
 - Google Analytics
scripts:
 - /assets/2015-01-21-referrer-spam/ga.js
image: /assets/2015-01-21-referrer-spam/referrer-spam.png
updated: 2015-04-03
description: >
 If you are using Google Analytics you may have noticed page views with referrals from ilovevitaly.com, darodar.com,
 priceg.com, blackhatworth.com, o-o-6-o-o.com and other suspicious domains appearing in your statistics. These are so
 called ghost referrals. This article describes in depth how this type of referrer spam works and debunks some common
 misconceptions about it. It also discusses possible solutions, include solutions that have been proposed elsewhere as
 well as an alternative solution that is more robust.
disqus: true
---

{:nofollow: rel="nofollow"}

## TL;DR

*   Make sure that you understand the difference between ghost referrals and bots. They require different
    counter-measures. In particular, changes to `.htaccess` are only effective against bots, not ghost referral spam.

*   Don't try using referral exclusion lists to eliminate referrer spam. This will not have the effect you expect.

*   If you ready to update your filters weekly with the newest list of fake referrals (or are paid to do that...), use a
    custom filter based on the *Referral* field.

*   If you don't want to update your filters on a regular basis and can't change the Google Analytics tracking code on
    your site, use a filter based on the *Hostname* field. Make sure that you understand the implications and know the
    pitfalls.

*   If you have control over the JavaScript code on your site and don't mind introducing a discontinuity in the
    analytics data for your home page, change the tracking code to report `/index.html` instead of `/` and create a
    filter based on the *Request URI* field to exclude all page views for `/`.

*   If none of the above fits your needs, use custom dimensions to distinguish between ghost referral spam and
    legitimate traffic.

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

Fake referrals with the characteristics described above are now commonly called *ghost referrals*.
It is important to distinguish this particular type of spam from another form of nuisance,
namely bots that automatically crawl your
site and that leave similar traces in your analytics data. The typical example for this is the
[Semalt crawler][semalt]{:nofollow}. Producing entries in your site's referrer list is (probably) not their primary
purpose, but they do so as a side effect. They can be distinguished by the fact that page titles and hostnames are
reported correctly.

In the present article I will not discuss bots any further and focus only on ghost referral spam.
In particular I would like to address two things. First, I will describe in depth how this type of
spam works and try to debunk some common misconceptions about it.
Then I will discuss possible solutions for that problem. This includes solutions that have been proposed elsewhere as
well as an alternative solution that I find more robust.

## How ghost referral spam works

To show how ghost referral spam works, we first need to examine how page views are reported to Google Analytics. When a page
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
  The only information that the spammer needs is the property ID.

* Once the spammer has the property ID, he can generate page views in Google Analytics without
  sending requests to the actual Web site. This implies that there is no way to prevent this type of spam by
  implementing changes to the site (e.g. to the JavaScript in the Web pages or the `.htaccess` file).

This leaves the question how the spammer gets the property ID of your Web site. There are two possibilities:

* As mentioned earlier, the property ID is actually public information because it must be included somehow in every
  (tracked) Web page on your site. One way for the spammer to get property IDs is therefore to crawl the Web using a
  bot and scrape the IDs from the visited pages.

* The spammer can simply target random property IDs. Given the structure of the ID, there is indeed a significant
  probability of hitting an existing property by choosing an ID randomly. In addition to that, property IDs are
  likely assigned in some sequential way, which would allow the spammer to easily narrow down the target to recently
  created properties or accounts.

There is ample evidence that the second approach is prevalent (and we will use that as an assumption in the following
sections):

* If the spammer targets random property IDs, he neither knows the domain name corresponding to the property nor the
  page titles. This explains why ghost referral spam is reported with fake hastnames and page titles, as observed in the
  introduction.

* [Some][so-29006845] [users][so-29422179] have reported that they received referrer spam even before their Web site went live or
  was widely known.

* Some people also noticed that ghost referral spam is received only for the first Web property in an account, i.e. the
  one that has an ID ending with `-1`. Note that if you are setting up a new Web site (or adding GA to an existing
  Web site) you can leverage that fact to protect it against ghost referral spam.

Here is a list of domains used in ghost referrals that are known to be produced using this technique:

* `blackhatworth.com`

* `darodar.com`

* `hulfingtonpost.com`

* `humanorightswatch.org`

* `ilovevitaly.com`

* `o-o-6-o-o.com`

* `priceg.com`

* `s.click.aliexpress.com`

* `simple-share-buttons.com`

## The impact of referrer spam

Obviously the primary impact of (any type of) referrer spam is that it decreases the accuracy of your analytics data.
Some webmasters also worry that this might have a negative impact on their site's search ranking. However, this is not
the case: [Google Analytics data is not used in any way for search ranking][ga-ranking].

## How to eliminate ghost referral spam

A [common recommendation][referral-filter] to prevent ghost referrer spam in Google Analytics is to eliminate the
fake page views by creating a filter that uses a criteria based on the *Referral* field (Not to be confused with adding the
domains to the [referral exclusion list][referral-exclusion], which serves an entirely different purpose!).
However, this approach is ineffective
because the referrals used by the spammers will change over time and you would have to update your filters on a regular
basis.

Some people recommend to use a filter based on the *Campaign Source* field; this is basically equivalent because in the
absence of an explicit campaign source, GA uses the referrer as default (except for search engine traffic).

Another approach that has been [suggested][hostname-filter] is to use filters based on the *Hostname* field. As we have seen
earlier, since the spammers simply try random property IDs, they don't know the hostname of the Web site corresponding
to a Web property they sent spam to. This means that it is possible to filter out the fake page
views by configuring a whitelist of legitimate hostnames.
The drawback of this approach is that it is easy to [accidentally filter out valid page views][webmasters-78446].
E.g. if somebody views
a page of your site through Google Translate, this will be reported as a page view with hostname
`translate.googleusercontent.com`. If you want to preserve these page views, then all relevant hostnames need to be
included in the whitelist, which may be tricky.

In this article, I propose another approach that relies on the simple observation that all ghost referral spam is reported
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

With that change, you can safely eliminate ghost referrals by creating a filter that excludes all page views with
the *Request URI* field set to `/`, because that URI will no longer be reported in legitimate page views:

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
change the tracking code to always send a specific value for that custom dimension in all page views. Ghost referral spam can
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
[so-29006845]: http://stackoverflow.com/questions/29006845/how-this-strange-traffic-from-samara-russia-works
[so-29422179]: http://stackoverflow.com/questions/29422179/google-analytics-showing-hundreds-of-views-for-page-that-doesnt-exist
[referral-exclusion]: https://support.google.com/analytics/answer/2795830
[webmasters-78446]: http://webmasters.stackexchange.com/questions/78446/why-does-it-seem-my-ga-include-only-hostname-filter-is-filtering-out-hits-from-t
