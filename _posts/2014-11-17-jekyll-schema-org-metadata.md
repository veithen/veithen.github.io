---
layout: post
title: "Adding schema.org metadata to Jekyll"
category: tech
tags:
 - Jekyll
---

I recently decided to migrate my Blogger blog to Jekyll, using [Jekyll Now](https://github.com/barryclark/jekyll-now)
as a starting point. I soon realized that Google+ no longer extracted snippets from links to posts I wanted to share:

![Screenshot without metadata](/assets/2014-11-17-jekyll-schema-org-metadata/without-metadata.png)

As can be seen in this screenshot, Google+ only shows the title and the Web site, but no snippets for posts
generated with the kind of Jekyll layout I was using.
While researching why this happens, I found the following document that explains how Google produces
snippets for pages shared via Google+:

[https://developers.google.com/+/web/snippet/](https://developers.google.com/+/web/snippet/)

According to that document the recommended way to enable snippets is to annotate the page with
[schema.org microdata](http://schema.org/docs/gs.html). For a blog post the appropriate item type
is [http://schema.org/Article](http://schema.org/Article) or [http://schema.org/BlogPosting](http://schema.org/BlogPosting).
Google+ uses the `name` property to extract the title and the `description` property to generate
the snippet, but while we are at it, we may as well use some additional properties such as
`keywords` and `datePublished` to annotate information that is available in Jekyll anyway.

Although the snippet extraction actually works if the entire body of the post is annotated as `description`,
that would obviously be a misuse of the [http://schema.org/Article](http://schema.org/Article) schema.
A more accurate way is to annotate the body with `articleBody` and to produce the `description` property
using the `strip_html` and `truncatewords` (or `truncate`) filters provided by the Liquid Templating language.

A blog post layout may then look like this:

{% raw %}
    <article class="post" itemscope="itemscope" itemtype="http://schema.org/Article">
      <meta itemprop="keywords" content="{{ page.tags | join: ',' }}" />
      <meta itemprop="description"
            content="{{ content | strip_html | truncatewords: 40 }}" />
    
      <h1 itemprop="name">{{ page.title }}</h1>
    
      <ul class="taglist">
      {% for tag in page.tags %}
        <li class="tag">{{ tag }}</li>
      {% endfor %}
      </ul>
    
      <time class="published" itemprop="datePublished"
            datetime="{{ page.date | date: '%Y-%m-%d' }}">
        {{ page.date | date: "%B %e, %Y" }}
      </time>
    
      <div class="entry" itemprop="articleBody">
        {{ content }}
      </div>
    </article>
{% endraw %}

The schema.org microdata is provided by the `itemscope`, `itemtype` and `itemprop` attributes.
Also notice the usage of `<meta>` tags for properties the values of which don't appear literally on the rendered page.

With this layout, Google+ will now generate the kind of snippets we would expect:

![Screenshot with metadata](/assets/2014-11-17-jekyll-schema-org-metadata/with-metadata.png)

If you want to check the correctness of the metadata on your pages, you can use the following online tool
provided by Google:

[http://www.google.com/webmasters/tools/richsnippets](http://www.google.com/webmasters/tools/richsnippets)
