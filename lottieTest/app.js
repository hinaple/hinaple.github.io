let anim = bodymovin.loadAnimation({
    container: document.body,
    path: 'data.json',
    renderer: 'svg',
    loop: true,
    autoplay: true
});

anim.play();