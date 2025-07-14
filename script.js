// 将来の機能追加に備えて空のJavaScriptファイルを用意

// ニュースを動的に追加したい場合、JavaScriptで内容を更新できます。
const recentNews = [
    { date: "2025年7月14日", content:"JpGU2025学生優秀発表賞を受賞しました。"},
    { date: "2025年5月30日", content:"JpGU2025で発表しました。"},
    { date: "2025年2月25日", content: "共著論文がPRLで出版されました。" },
    { date: "2024年12月09日", content: "AGU24に参加しました。" },
    { date: "2024年9月3日", content: "IPGPに訪問しています。" },
    { date: "2024年7月12日", content: "JpGU2024学生発表優秀賞を受賞しました。" }
];

const newsList = document.getElementById("recent-news");
recentNews.forEach(news => {
    const listItem = document.createElement("li");
    listItem.textContent = `${news.date} - ${news.content}`;
    newsList.appendChild(listItem);
});