let headerLogo = bodymovin.loadAnimation({
    container: document.getElementById("headerLogo"),
    path: "assets/logo.json",
    renderer: "canvas",
    loop: true,
    autoplay: true
});

let mainLogo = bodymovin.loadAnimation({
    container: document.getElementById("mainLogo"),
    path: "assets/logoWhite.json",
    renderer: "canvas",
    loop: true,
    autoplay: true
});

const swiper = new Swiper('.card-news', {
    pagination: {
        el: '.swiper-pagination',
    },
  
    navigation: {
        nextEl: '.swiper-button-next',
        prevEl: '.swiper-button-prev',
    }
});