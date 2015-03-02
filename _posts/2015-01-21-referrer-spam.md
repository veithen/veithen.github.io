---
layout: post
title: "Understanding and eliminating referrer spam in Google Analytics"
category: tech
tags:
 - Google Analytics
scripts:
 - /assets/2015-01-21-referrer-spam/ga.js
image: /assets/2015-01-21-referrer-spam/referrer-spam.png
updated: 2015-03-02
---

## Introduction

If you are using Google Analytics you may have noticed page views with referrals from `ilovevitaly.com`, `darodar.com`,
`priceg.com`, `blackhatworth.com`, `o-o-6-o-o.com` and other suspicious domains appearing in your statistics:

![Referrer span in Google Analytics]({{ page.image }})

This is so called *referrer spam* and there have been a lot of [discussions][discussion] about this issue recently.
Instead of repeating what has already been written elsewhere, in the present article I would like to focus on two
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
  The only information that the spammer needs is the property ID, but that information is public because it can be
  extracted from any Web page on your site. The spammer may also simply try random property IDs. Given the structure
  of the ID, there is indeed a significant probability of hitting an existing property by choosing an ID randomly.

* Once the spammer has obtained (or guessed) the property ID, he can generate page views in Google Analytics without
  sending requests to the actual Web site. This implies that there is no way to prevent this type of spam by
  implementing changes to the site (e.g. to the JavaScript in the Web pages or the `.htaccess` file).

## How to prevent referrer spam

A [common recommendation][referral-filter] to prevent this type of referrer spam in Google Analytics is to eliminate the
fake page views by creating a filter that uses a criteria based on the referral. However, this approach is ineffective
because the referrals used by the spammers will change over time and you would have to update your filters on a regular
basis.

A better approach is to use filters based on hostnames. This strategy is described [here][hostname-filter].
It relies on the assumption that the spammer simply tries random property IDs and therefore doesn't know the
hostname of the Web site corresponding to the Web property. This means that it is possible to filter out the fake page
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

[discussion]: https://productforums.google.com/d/topic/analytics/q62Z9dNe524/discussion
[tracking-code]: https://developers.google.com/analytics/devguides/collection/analyticsjs/#quickstart
[protocol-reference]: https://developers.google.com/analytics/devguides/collection/protocol/v1/reference
[page-tracking-request]: https://developers.google.com/analytics/devguides/collection/protocol/v1/devguide#page
[hostname-filter]: http://www.analyticsedge.com/2014/12/removing-referral-spam-google-analytics/
[overriding]: https://developers.google.com/analytics/devguides/collection/analyticsjs/pages#overriding
[previous-post]: /2015/01/05/jekyll-improving-ga-data-quality.html
[referral-filter]: http://www.jeffalytics.com/8-steps-eliminating-bad-data-google-analytics/
