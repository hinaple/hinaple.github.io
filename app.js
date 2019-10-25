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