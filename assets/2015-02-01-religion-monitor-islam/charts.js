$(function() {
    new Chart($("#chart1").get(0).getContext("2d")).Bar({
        labels: [">50 years", "41-50 years", "31-40 years", "16-30 years"],
        datasets: [
            {
                label: "Highly religious",
                fillColor: "#2DAAE1",
                data: [20, 49, 63, 57]
            }
        ]
    }, {
        scaleOverride: true,
        scaleSteps: 10,
        scaleStepWidth: 10,
        scaleStartValue: 0
    });
    new Chart($("#chart2").get(0).getContext("2d")).Bar({
        labels: ["not/minimally religious", "moderately religious", "highly religious"],
        datasets: [
            {
                label: "Support for gay marriage",
                fillColor: "#CC0099",
                data: [67, 60, 40]
            }
        ]
    }, {
        scaleOverride: true,
        scaleSteps: 10,
        scaleStepWidth: 10,
        scaleStartValue: 0
    });
});
