// 将来の機能追加に備えて空のJavaScriptファイルを用意

// ニュースを動的に追加したい場合、JavaScriptで内容を更新できます。
const recentNews = [
    { date: "2025年12月17日", content:"主著論文がEPSLで出版されました。"},
    { date: "2025年10月3日", content:"AIRAPT-29でStudent Poster Awardを受賞しました。"},
    { date: "2025年9月27日", content:"共著論文がJGR:Solid Earthで出版されました。"},
    { date: "2025年8月14日", content:"SPring-8 NEWSに紹介されました。"},
    { date: "2025年7月14日", content:"JpGU2025学生優秀発表賞を受賞しました。"},
    { date: "2025年5月30日", content:"JpGU2025で発表しました。"},
    { date: "2025年2月25日", content: "共著論文がPRLで出版されました。" },
];

const newsList = document.getElementById("recent-news");
recentNews.forEach(news => {
    const listItem = document.createElement("li");
    listItem.textContent = `${news.date} - ${news.content}`;
    newsList.appendChild(listItem);
});