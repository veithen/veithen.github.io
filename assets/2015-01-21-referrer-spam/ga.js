require(["jquery"], function($) {
    $(document).ready(function() {
        $("form").submit(function(event) {
            $.ajax({
                type: "GET",
                url: "http://www.google-analytics.com/collect",
                data: {
                    "v": 1,
                    "tid": $("input[name=tid]").val(),
                    "cid": Math.floor(Math.random() * 10000000),
                    "t": "pageview",
                    "dh": $("input[name=dh]").val(),
                    "dp": $("input[name=dp]").val(),
                    "dt": $("input[name=dt]").val(),
                }
            }).done(function(data) {
                alert('Event successfully submitted');
            }).fail(function(xhr, textStatus, errorThrown) {
                alert('Failed to submit event');
            });
            event.preventDefault();
        });
    });
});
