// 将来の機能追加に備えて空のJavaScriptファイルを用意

// ニュースを動的に追加したい場合、JavaScriptで内容を更新できます。
const recentNews = [
    { date: "2026年6月22日", content:"主著論文がJGR:Planetsで出版されました。"},
    { date: "2026年6月17日", content:"SPring-8大学院生課題優秀研究賞を受賞しました。"},
    { date: "2026年5月27日", content:"JpGU2026で口頭発表を行いました"},
    { date: "2026年4月13日", content:"共著論文がGCAで出版されました。"},
    { date: "2026年3月24日", content:"博士課程を修了しました。"},
    { date: "2026年3月10日", content:"東京大学 理学系研究科研究奨励賞(博士)を受賞しました。"},
    { date: "2025年12月17日", content:"主著論文がEPSLで出版されました。"},
    { date: "2025年10月3日", content:"AIRAPT-29でStudent Poster Awardを受賞しました。"},
    { date: "2025年9月27日", content:"共著論文がJGR:Solid Earthで出版されました。"},
    { date: "2025年8月14日", content:"SPring-8 NEWSに紹介されました。"},
    { date: "2025年7月14日", content:"JpGU2025学生優秀発表賞を受賞しました。"},
    { date: "2025年5月30日", content:"JpGU2025で発表しました。"},
];

const newsList = document.getElementById("recent-news");
recentNews.forEach(news => {
    const listItem = document.createElement("li");
    listItem.textContent = `${news.date} - ${news.content}`;
    newsList.appendChild(listItem);
});