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

const swiper1 = new Swiper('#covid', {
    pagination: {
        el: '#covidPag',
    },
  
    navigation: {
        nextEl: '#covidNext',
        prevEl: '#covidPrev',
    }
});

const swiper2 = new Swiper('#cartoons', {
    pagination: {
        el: '#cartoonPag',
    },
  
    navigation: {
        nextEl: '#cartoonNext',
        prevEl: '#cartoonPrev',
    }
});

const Files = [
    "20205 김다희.hwp",
    "20208 김유은.hwp",
    "20222 송슬기.hwp",
    "20315 박소연.hwp",
    "20612 박시원.hwp",
    "20614 박지연.hwp",
    "김다희 송슬기.hwp",
    "김영진 박천규 강민준.hwp",
    "박소연.pdf",
    "박천규 독후감.hwp",
    "신채화 독후감.hwp",
    "심은우 독후감.hwp",
    "최준석.hwp",
    "한지수 독후감.hwp",
    "허지유 독후감.hwp",
    "홍석주 독후감.hwp",
    "홍석주.txt",
]

const FileWrapper = document.getElementById("fileWrapper");

for(let i = 0; i < Files.length; i++) {
    const tempFile = document.createElement('a');
    tempFile.className = "file";

    tempFile.href = "downloadFile/" + Files[i];
    tempFile.setAttribute("download", "");

    const Div = document.createElement("div");
    Div.className = "file-div";

    Div.innerText = Files[i].replace(/\..*/, '');

    tempFile.appendChild(Div);
    FileWrapper.appendChild(tempFile);
}