function myFunction() {
  document.getElementById("myDropdown").classList.toggle("show");
}

// Close the dropdown if the user clicks outside of it
window.onclick = function (event) {
  if (!event.target.matches(".header-username")) {
    var dropdowns = document.getElementsByClassName("dropdown-content");
    var i;
    for (i = 0; i < dropdowns.length; i++) {
      var openDropdown = dropdowns[i];
      if (openDropdown.classList.contains("show")) {
        openDropdown.classList.remove("show");
      }
    }
  }
};

jQuery(document).ready(function ($) {
  "use strict";

  // Remove custom scrollbar styling
  document.body.style.overflow = 'auto';
  document.getElementById('viewport').style.overflow = 'visible';
  document.getElementById('js-scroll-content').style.overflow = 'visible';

  // Add smooth scroll handling for anchor links
  $('a[href^="#"]').on('click', function(e) {
    e.preventDefault();
    const target = $(this.hash);
    if (target.length) {
      const offset = target.offset().top;
      $('html, body').animate({
        scrollTop: offset
      }, 1000, 'swing');
    }
  });

  var book_table = new Swiper(".book-table-img-slider", {
    slidesPerView: 1,
    spaceBetween: 20,
    loop: true,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false,
    },
    speed: 2000,
    effect: "coverflow",
    coverflowEffect: {
      rotate: 3,
      stretch: 2,
      depth: 100,
      modifier: 5,
      slideShadows: false,
    },
    loopAdditionSlides: true,
    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
  });

  var team_slider = new Swiper(".team-slider", {
    slidesPerView: 3,
    spaceBetween: 30,
    loop: true,
    autoplay: {
      delay: 3000,
      disableOnInteraction: false,
    },
    speed: 2000,

    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },
    pagination: {
      el: ".swiper-pagination",
      clickable: true,
    },
    breakpoints: {
      0: {
        slidesPerView: 1.2,
      },
      768: {
        slidesPerView: 2,
      },
      992: {
        slidesPerView: 3,
      },
      1200: {
        slidesPerView: 3,
      },
    },
  });

  jQuery(".filters").on("click", function () {
    jQuery("#menu-dish").removeClass("bydefault_show");
  });
  $(function () {
    var filterList = {
      init: function () {
        $("#menu-dish").mixItUp({
          selectors: {
            target: ".dish-box-wp",
            filter: ".filter",
          },
          animation: {
            effects: "fade",
            easing: "ease-in-out",
          },
          load: {
            filter: ".all, .breakfast, .lunch, .dinner, .beverages, .desserts",
          },
        });
      },
    };
    filterList.init();
  });

  jQuery(".menu-toggle").click(function () {
    jQuery(".main-navigation").toggleClass("toggled");
  });

  jQuery(".header-menu ul li a").click(function () {
    jQuery(".main-navigation").removeClass("toggled");
  });

  gsap.registerPlugin(ScrollTrigger);

  var elementFirst = document.querySelector(".site-header");
  ScrollTrigger.create({
    trigger: "body",
    start: "30px top",
    end: "bottom bottom",

    onEnter: () => myFunction(),
    onLeaveBack: () => myFunction(),
  });

  function myFunction() {
    elementFirst.classList.toggle("sticky_head");
  }

  var scene = $(".js-parallax-scene").get(0);
  var parallaxInstance = new Parallax(scene);
});

jQuery(window).on("load", function () {
  $("body").removeClass("body-fixed");

  //activating tab of filter
  let targets = document.querySelectorAll(".filter");
  let activeTab = 0;
  let old = 0;
  let dur = 0.4;
  let animation;

  for (let i = 0; i < targets.length; i++) {
    targets[i].index = i;
    targets[i].addEventListener("click", moveBar);
  }

  // initial position on first === All
  gsap.set(".filter-active", {
    x: targets[0].offsetLeft,
    width: targets[0].offsetWidth,
  });

  function moveBar() {
    if (this.index != activeTab) {
      if (animation && animation.isActive()) {
        animation.progress(1);
      }
      animation = gsap.timeline({
        defaults: {
          duration: 0.4,
        },
      });
      old = activeTab;
      activeTab = this.index;
      animation.to(".filter-active", {
        x: targets[activeTab].offsetLeft,
        width: targets[activeTab].offsetWidth,
      });

      animation.to(
        targets[old],
        {
          color: "#0d0d25",
          ease: "none",
        },
        0
      );
      animation.to(
        targets[activeTab],
        {
          color: "#fff",
          ease: "none",
        },
        0
      );
    }
  }
});

// Parallax Tilt Effect
class ParallaxTilt {
    constructor(element) {
        this.element = element;
        this.settings = {
            perspective: parseInt(element.getAttribute('data-tilt-perspective')) || 500,
            maxTilt: parseInt(element.getAttribute('data-tilt-max')) || 2,
            speed: parseInt(element.getAttribute('data-tilt-speed')) || 400
        };
        
        this.elementRect = this.element.getBoundingClientRect();
        this.init();
    }

    init() {
        this.element.style.transition = `transform ${this.settings.speed}ms cubic-bezier(.03,.98,.52,.99)`;
        this.element.style.transform = "perspective(" + this.settings.perspective + "px) rotateX(0) rotateY(0)";
        
        this.addEventListeners();
    }

    addEventListeners() {
        this.element.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.element.addEventListener('mouseleave', () => this.onMouseLeave());
    }

    onMouseMove(e) {
        const rect = this.element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const xc = rect.width / 2;
        const yc = rect.height / 2;
        
        const dx = (x - xc) / xc;
        const dy = (y - yc) / yc;
        
        this.element.style.transform = `
            perspective(${this.settings.perspective}px)
            rotateX(${dy * this.settings.maxTilt}deg)
            rotateY(${dx * this.settings.maxTilt}deg)
            scale3d(1.02, 1.02, 1.02)
        `;
    }

    onMouseLeave() {
        this.element.style.transform = `
            perspective(${this.settings.perspective}px)
            rotateX(0deg)
            rotateY(0deg)
            scale3d(1, 1, 1)
        `;
    }
}

// Initialize parallax effect for panels
document.addEventListener('DOMContentLoaded', () => {
    const tiltElements = document.querySelectorAll('.js-tilt');
    tiltElements.forEach(element => new ParallaxTilt(element));
});
