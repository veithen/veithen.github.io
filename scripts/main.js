(function(){
    $(document).ready(function() {
        $("ul.tag-box li a").click(function(e){
            e.preventDefault()
            $("ul.post-list li").hide();
            $("ul.post-list li").removeClass("hidden");
            $("ul.post-list li article[data-tag-"+$(this).attr("data-tag")+"]").parent().fadeIn()
        })
    });
})()
