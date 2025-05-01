(function() {
    console.log("starting common.js");

    const fathomSiteId = "TESTSITEID";

    function loadFathom() {
        const script = document.createElement('script');
        script.src = 'https://cdn.usefathom.com/script.js';
        script.defer = true;
        script.setAttribute('data-site', fathomSiteId);
        document.head.appendChild(script);
    }

    function loadFreshdeskWidget() {
        const script = document.createElement('script');
        script.src = 'https://s3.amazonaws.com/assets.freshdesk.com/widget/freshwidget.js';
        script.defer = true;
        script.onload = () => {
            FreshWidget.init("", {
                "queryString": "&widgetType=popup&helpdesk_ticket[group_id]=6000207804&helpdesk_ticket[product_id]=6000005589&formTitle=Report+an+issue+or+ask+for+help",
                "utf8": "✓",
                "widgetType": "popup",
                "buttonType": "text",
                "buttonText": "Need help?",
                "buttonColor": "white",
                "buttonBg": "#d5502a",
                "alignment": "2",
                "offset": "350px",
                "formHeight": "500px",
                "url": "https://support.ala.org.au"
            });
        }
        document.head.appendChild(script);
    }

    // Fathom is not enabled in this environment
    // loadFathom();

    loadFreshdeskWidget();
})();
