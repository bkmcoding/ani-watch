export const mockHtmlData = {
  homepage: `
    <div class="deslide-wrap">
      <div class="swiper-wrapper">
        <div class="swiper-slide">
          <div class="deslide-cover">
            <img class="film-poster-img" data-src="https://example.com/poster.jpg">
          </div>
          <div class="desi-head-title">Spotlight Anime</div>
          <div class="desi-description">Description text</div>
          <div class="desi-buttons">
            <a href="/watch/spotlight-123"></a>
          </div>
          <div class="sc-detail">
            <span class="scd-item">TV</span>
            <span class="scd-item">24m</span>
            <span class="scd-item m-hide">Oct 1, 2023</span>
            <span class="tick-sub">12</span>
            <span class="tick-dub">10</span>
            <span class="tick-eps">12</span>
          </div>
        </div>
      </div>
    </div>
    <div id="trending-home">
      <div class="swiper-container">
        <div class="swiper-slide">
          <div class="item">
            <div class="film-title">Trending Anime</div>
            <a href="/watch/trending-456" class="film-poster">
              <img data-src="https://example.com/trending.jpg">
            </a>
          </div>
        </div>
      </div>
    </div>
    <div id="anime-featured">
      <div class="anif-blocks">
        <div class="anif-block">
          <div class="anif-block-header">Most Popular</div>
          <div class="anif-block-ul">
            <ul>
              <li>
                <div class="film-poster">
                  <img class="film-poster-img" data-src="https://example.com/popular.jpg">
                </div>
                <div class="film-detail">
                  <h3 class="film-name"><a href="/watch/popular-789" title="Popular Anime"></a></h3>
                  <div class="fd-infor">
                    <span class="fdi-item">TV</span>
                    <span class="fdi-item">24m</span>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  `,
  detail: `
    <div id="ani_detail">
      <div class="anis-content">
        <div class="film-poster">
          <img class="film-poster-img" src="https://example.com/detail.jpg">
          <div class="tick-rate">18+</div>
        </div>
        <div class="anisc-detail">
          <h2 class="film-name">Detail Anime</h2>
          <div class="film-stats">
            <div class="tick">
              <span class="item">TV</span>
              <span class="tick-sub">12</span>
              <span class="tick-dub">10</span>
              <span class="tick-eps">12</span>
            </div>
          </div>
          <div class="film-buttons">
            <a href="/watch/detail-123" class="btn"></a>
          </div>
        </div>
        <div class="anisc-info-wrap">
          <div class="anisc-info">
            <div class="item">
              <span class="item-head">Japanese:</span>
              <span class="name">日本語</span>
            </div>
            <div class="item">
              <span class="item-head">Aired:</span>
              <span class="name">Oct 1, 2023 to ?</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  search: `
    <div class="block_area-content block_area-list film_list">
      <div class="film_list-wrap">
        <div class="flw-item">
          <div class="film-poster">
            <img class="film-poster-img" data-src="https://example.com/search.jpg">
            <a href="/watch/search-123"></a>
          </div>
          <div class="film-detail">
            <h3 class="film-name"><a class="dynamic-name" href="/watch/search-123">Search Result</a></h3>
            <div class="fd-infor">
               <span class="fdi-item">TV</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  characters: `
    <div class="block_area-content block_area-list film_list">
      <div class="film_list-wrap">
        <div class="bac-item">
          <div class="per-info">
            <div class="pi-avatar">
              <a href="/character/char-123">
                <img data-src="https://example.com/character.jpg">
              </a>
            </div>
            <div class="pi-detail">
              <div class="pi-name"><a href="/character/char-123">Character Name</a></div>
              <div class="pi-cast">Main</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  news: `
    <div class="zr-news-list">
      <div class="item">
        <a class="zrn-title" href="/news/news-123"></a>
        <h3 class="news-title">News Title</h3>
        <div class="description">News description</div>
        <img class="zrn-image" src="https://example.com/news.jpg">
        <div class="time-posted">Oct 1, 2023</div>
      </div>
    </div>
  `,
  schedule: `
    <div class="block_area-content block_area-list film_list">
      <a href="/watch/anime-123">
        <div class="time">10:00</div>
        <div class="film-name" data-jname="Schedule Alt">Scheduled Anime</div>
        <div class="btn-play">Episode 5</div>
      </a>
    </div>
  `,
  episodes: `
    <div class="block_area-content block_area-list film_list">
      <div class="detail-channels">
        <a class="ssl-item ep-item" href="/watch/ep-1" title="Episode 1">
          <div class="ep-name e-dynamic-name" data-jname="Ep 1 Alt"></div>
        </a>
      </div>
    </div>
  `,
  characterDetail: `
    <div class="actor-page-wrap">
      <div class="avatar">
        <img src="https://example.com/char-detail.jpg">
      </div>
      <div class="apw-detail">
        <div class="name">Character Full Name</div>
        <div class="sub-name">Character Japanese Name</div>
        <div class="tab-content">
          <div id="bio">
            <div class="bio"><p>Character biography</p></div>
          </div>
        </div>
      </div>
    </div>
  `,
  suggestions: `
    <div class="nav-item">
      <a href="/watch/suggest-1">
        <img class="film-poster-img" data-src="https://example.com/s1.jpg">
        <div class="film-name">S1</div>
        <div class="film-infor"><span>A1</span><span>D1</span></div>
      </a>
    </div>
    <div class="nav-item">
      <a href="/watch/suggest-2">
        <img class="film-poster-img" data-src="https://example.com/s2.jpg">
        <div class="film-name">S2</div>
        <div class="film-infor"><span>A2</span><span>D2</span></div>
      </a>
    </div>
    <div class="nav-item">
      <a href="/watch/suggest-3">
        <img class="film-poster-img" data-src="https://example.com/s3.jpg">
        <div class="film-name">Suggest Title</div>
        <div class="film-infor"><span>A3</span><span>D3</span></div>
      </a>
    </div>
  `,
  topSearch: `
    <div class="xhashtag">
      <a class="item" href="/watch/top-1">T1</a>
      <a class="item" href="/watch/top-2">T2</a>
      <a class="item" href="/watch/top-123">Top Title</a>
    </div>
  `,
  scheduleNext: `
    <div class="block_area-content">
      <div id="schedule-date" data-value="10:00"></div>
    </div>
  `,
};
