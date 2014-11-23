(function(){
    $(document).ready(function() {
        $("#tabs").tabs();
        $(".ui-tabs-panel").each(function() {
            var tagCloud = $(this).find("ul.tag-box")
            var postList = $(this).find("ul.post-list")
            var tags = {}
            postList.find("meta[itemprop='keywords']").each(function() {
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
                li.appendTo(tagCloud)
                var a = $("<a href=''>" + tag + " <span>" + count + "</span></a>")
                a.appendTo(li)
                a.click(function(e) {
                    e.preventDefault()
                    postList.find("meta[itemprop='keywords']").each(function() {
                        var li = $(this).parent().parent()
                        var matches = $(this).attr("content").split(",").indexOf(tag) != -1
                        if (matches != $(li).is(":visible")) {
                            if (matches) {
                                $(li).show("slow")
                            } else {
                                $(li).hide("slow")
                            }
                        }
                    })
                })
            })
            postList.find("li").hide();
            postList.find("li").removeClass("hidden");
        })
    });
})()
