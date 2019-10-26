swal({
    icon: "warning",
    title: "WAIT!",
    text: "THIS PAGE IS MADE FOR FULL-SCREEN MODE!\nIF YOU CLICK THE OK BUTTON,\nTHIS PAGE WILL WORK ON FULL-SCREEN."
})
.then(() => {
    toggleFullScreen();
    $(".title").css("animation-play-state", "running");
    $(".circle").css("animation-play-state", "running");
    $(".text").css("animation-play-state", "running");
    $(".works").css("animation-play-state", "running");
    $(".github").css("animation-play-state", "running");
    $(".work.w").css("animation-play-state", "running");
    $(".meal").css("animation-play-state", "running");
    $(".chat").css("animation-play-state", "running");
    $(".under-bar").css("animation-play-state", "running");
    blink = setInterval(() => { bCnt++; }, 1000);
});

$(window).scroll(() => {
    var scroll = $(this).scrollTop();
    console.log(scroll);
    if(scroll > 1100) {
        $(".tab").text("Bongdam ms meal");
        $(".url").val("http://meal.odcb.kr/");
    }
    else $(".tab").text("portfolio");
    if(scroll > 2330) $(".tab").text("Bongdam ms calendar");
    if(scroll > 3440) $(".tab").text("online chatting");
});

var bCnt = 0;
var blink;
$(".works").mouseover(() => {
    if(bCnt % 2 == 1) $(".works").css("animation", "blink 1s " + (bCnt + 2) + " alternate-reverse ease-in-out");
    else $(".works").css("animation", "blink 1s " + (bCnt + 1) + " alternate-reverse ease-in-out");
    console.log(bCnt);
    clearInterval(blink);
});

function toggleFullScreen() {
    var doc = window.document;
    var docEl = doc.documentElement;

    var requestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
    var cancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
    if(!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
        requestFullScreen.call(docEl);
    }
    else {
        cancelFullScreen.call(doc);
    }
}