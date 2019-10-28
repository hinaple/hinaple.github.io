const height = window.innerHeight;


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
    if(scroll >= height) {
        $(".tab").text("Bongdam ms meal");
        $(".url").val("http://meal.odcb.kr/");
        $(".img.mealimg").css("animation-play-state", "running");
        $(".content.mealc").css("animation-play-state", "running");
    }
    else {
        $(".tab").text("portfolio");
        $(".url").val("http://odcb.kr/");
    }
    if(scroll >= height * 2) {
        $(".tab").text("Bongdam ms calendar");
        $(".url").val("http://haksa.odcb.kr/");
        $(".img.haksaimg").css("animation-play-state", "running");
        $(".content.haksac").css("animation-play-state", "running");
        $(".bibe").css("animation-play-state", "running");
    }
    if(scroll >= height * 3) {
        $(".tab").text("online chatting");
        $(".url").val("http://onchat.odcb.kr/");
    }
});

var bCnt = 0;
var blink;
var blinking = true;
$(".works").mouseover(() => {
    if(!blinking) return;
    if(bCnt <= 0) $(".works").css("animation", "worksSpread 1s");
    else if(bCnt % 2 == 1) $(".works").css("animation", "blink 1s " + (bCnt + 2) + " alternate-reverse ease-in-out");
    else $(".works").css("animation", "blink 1s " + (bCnt + 1) + " alternate-reverse ease-in-out");
    clearInterval(blink);
    blinking = false;
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