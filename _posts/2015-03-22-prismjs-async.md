---
layout: post
title: How to load PrismJS asynchronously
category: tech
tags:
 - RequireJS
twitter_text: "How to load #PrismJS asynchronously"
twitter_tags: RequireJS
disqus: true
description: >
 This article explains how to load the Prism syntax highlighter asynchronously using RequireJS. The aim is to remove
 Prism from the critical rendering path so that it no longer blocks the initial rendering of the page. The end result
 should be a decrease in perceived page load time.
---

This article explains how to load the [Prism syntax highlighter][prismjs] asynchronously using [RequireJS][requirejs].
The aim is to remove Prism from the [critical rendering path][critical-rendering-path] so that it no longer blocks the
initial rendering of the page. The end result should be a decrease in perceived page load time. The tradeoff is that
the page may briefly be displayed without syntax highlighting, an effect called
[*Flash of unstyled content* (FOUC)][fouc]. Generally, this is an acceptable tradeoff, especially for pages that
contain much more text than code blocks.

**Note:** For convenience, we will use [jQuery][jquery] in addition to RequireJS, but the code presented in this
article could be easily rewritten to remove that dependency. On the other hand, removing the RequireJS dependency is
a bit trickier, because as we will see later, we rely on RequireJS to execute a piece of code after a script has been
loaded asynchronously.

The Prism JavaScript and Prism CSS file are typically included in a page with the following markup:

~~~ markup
<script src="/scripts/prism.js"></script>
<link rel="stylesheet" href="/style/prism.css" />
~~~

Both the [JavaScript][render-blocking-js] and the [CSS][render-blocking-css] are actually render-blocking and we need to
replace this with something that removes these resources from the critical path. Let's focus on the JavaScript part
first. One would expect that loading the Prism JavaScript asynchronously is as simple as adding the following code:

~~~ javascript
require(['prism']);
~~~

Alternatively, one could just load the script using `async`:

~~~ markup
<script src="/scripts/prism.js" async></script>
~~~

However, none of these methods work as expected. The reason is the following code in Prism:

~~~ javascript
// Get current script and highlight
var script = document.getElementsByTagName('script');

script = script[script.length - 1];

if (script) {
    _.filename = script.src;

    if (document.addEventListener && !script.hasAttribute('data-manual')) {
        document.addEventListener('DOMContentLoaded', _.highlightAll);
    }
}
~~~

The problem with this code is that it listens to the `DOMContentLoaded` event to automatically run the syntax
highlighting logic when the DOM is ready. However, if the script is loaded asynchronously, then there is no guarantee
that it will be executed before the `DOMContentLoaded` event is triggered. If it happens to start executing after that
event, then registering the event listener will have no effect and the `highlightAll` method will never be called.

One might think that the solution to this problem is skip the event listener registration by adding the `data-manual`
attribute and to call the `hightlightAll` method explicitly, e.g. using jQuery's [`ready`][jquery-ready] method.
However, there is another problem with the Prism code shown above: the method used to get the current `<script>` element
[doesn't work][so-403967] if the script is loaded asynchronously. This means that the `data-manual` attribute is not
recognized. Also note that even if that piece of code worked correctly, that solution would also
[require some tweaking][requirejs-687] in RequireJS to actually add that attribute.

This leaves us with two options:

*   Call the `highlightAll` method explicitly anyway. This means that if the script is executed before the DOM is ready,
    the method will be executed twice. This approach is safe because the method is actually idempotent. It has
    the advantage that the script can start loading early.

*   Only start loading the script when the DOM is ready and call the `highlightAll` method after the loading is
    complete. This approach guarantees that the method is executed once and only once. The drawback is that it will
    likely increase the FOUC effect because the script starts loading later.

Note that if in addition to loading the Prism script asynchronously you also want it to load on demand, i.e. only
if the page actually contains code blocks that require syntax highlighting, then the second approach is the way to go
because the code needs to wait for the DOM to be ready anyway in order to be able to determine if there are code blocks
on the page.

Both approaches require calling the `hightlightAll` method in the scope of a callback function invoked by RequireJS.
For this to work, you will need to modify the configuration as follows:

~~~ javascript
require.config({
    ...
    shim: {
        'prism': {
            exports: 'Prism'
        }
    }
});
~~~

If you opt for the first approach, then the code you need to add to your page would look as follows:

~~~ javascript
require(['jquery', 'prism'], function($, prism) {
    $(function() {
        prism.highlightAll();
    });
});
~~~

This takes care of loading the Prism JavaScript asynchronously. As mentioned earlier, we should also remove the Prism
CSS from the critical rendering path. There are two ways to achieve this:

*   Include the Prism styles into another stylesheet already used in the page and that is critical (i.e. that must
    be loaded before the page can be rendered). Obviously this will not remove the Prism styles themselves from the
    critical rendering path, but it will decrease the number of HTTP requests that the browser needs to perform before
    it can render the page.

*   Use [LoadCSS][loadCSS] to load the Prism CSS asynchronously.

With LoadCSS, the complete solution would look as follows:

~~~ javascript
loadCSS('/style/prism.css');
require(['jquery', 'prism'], function($, prism) {
    $(function() {
        prism.highlightAll();
    });
});
~~~

Note that you may need to tweak that code to ensure that the link to the Prism CSS is inserted in the right location in
the DOM so that you get the expected ordering of CSS files.

Finally, if you prefer the on-demand approach that only loads the Prism JavaScript and CSS if necessary, then the
code should look as follows:

~~~ javascript
require(['jquery'], function($) {
    $(function() {
        if ($('code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code').length) {
            loadCSS('/style/prism.css');
            require(['prism'], function(prism) {
                prism.highlightAll();
            });
        }
    });
});
~~~

[prismjs]: http://prismjs.com/
[requirejs]: http://requirejs.org/
[critical-rendering-path]: https://developers.google.com/web/fundamentals/performance/critical-rendering-path/
[fouc]: http://en.wikipedia.org/wiki/Flash_of_unstyled_content
[jquery]: https://jquery.com/
[so-403967]: http://stackoverflow.com/questions/403967/how-may-i-reference-the-script-tag-that-loaded-the-currently-executing-script#22745553
[requirejs-687]: https://github.com/jrburke/requirejs/issues/687
[jquery-ready]: http://api.jquery.com/ready/
[render-blocking-js]: https://developers.google.com/web/fundamentals/performance/critical-rendering-path/adding-interactivity-with-javascript
[render-blocking-css]: https://developers.google.com/web/fundamentals/performance/critical-rendering-path/render-blocking-css
[loadCSS]: https://github.com/filamentgroup/loadCSS
