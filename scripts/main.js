(function(){
    $(document).ready(function() {
    	var tags = {}
    	$("ul.post-list meta[itemprop='keywords']").each(function() {
    		$.each($(this).attr("content").split(","), function(index, tag) {
    			if (tags[tag]) {
    				tags[tag]++
    			} else {
    				tags[tag] = 1
    			}
    		})
    	})
    	$.each(tags, function(tag, count) {
    		var li = $("<li></li>")
    		li.appendTo($("ul.tag-box"))
    		var a = $("<a href=''>" + tag + " <span>" + count + "</span></a>")
    		a.appendTo(li)
            a.click(function(e) {
                e.preventDefault()
                $("ul.post-list li").hide();
                $("ul.post-list li").removeClass("hidden");
                $("ul.post-list li article[data-tag-" + tag + "]").parent().fadeIn()
            })
    	})
    });
})()
