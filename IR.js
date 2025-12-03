import { getDatabase, ref, query, orderByChild, get } from "./firebase.js";

const db = getDatabase();
const highScoresRef = ref(db, 'scores');
const masterMode = ref(db, 'scoreshell');
const easyMode = ref(db, 'scoreseasy');
const finalMode = ref(db, 'scoresfinal');
const highScoresQuery = query(highScoresRef, orderByChild('score'));
const masterModeQuery = query(masterMode, orderByChild('score'));
const easyModeQuery = query(easyMode, orderByChild('score'));
const finalModeQuery = query(finalMode, orderByChild('score'));
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const snapshot = await get(highScoresQuery);
        const masterSnapshot = await get(masterModeQuery);
        const easySnapshot = await get(easyModeQuery);
        const finalSnapshot = await get(finalModeQuery);
        if (snapshot.exists()) {
            const highScoresObj = snapshot.val();
            const highScoresList = document.querySelector("#scoreTable2");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const highScoresArr = Object.values(highScoresObj).sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return parseTime(a.time) - parseTime(b.time); // Sort by time in ascending order if scores are equal
                }
            });
            if (highScoresList) {
                highScoresArr.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const listItem = document.createElement("tr");
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td>${scoreData.score}</td>
                        <td>${scoreData.grade}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    highScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable' not found.");
            }
        }
        if (easySnapshot.exists()) {
            const easyScoresObj = easySnapshot.val();
            const easyScoresList = document.querySelector("#scoreTable");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const easyScoresArr = Object.values(easyScoresObj).sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return parseTime(a.time) - parseTime(b.time); // Sort by time in ascending order if scores are equal
                }
            });
            if (easyScoresList) {
                easyScoresArr.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const listItem = document.createElement("tr");
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td>${scoreData.score}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    easyScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable' not found.");
            }
        }
        if (finalSnapshot.exists()) {
            const finalScoresObj = finalSnapshot.val();
            const finalScoresList = document.querySelector("#scoreTable4");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const finalScoresArr = Object.values(finalScoresObj).sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return parseTime(a.time) - parseTime(b.time); // Sort by time in ascending order if scores are equal
                }
            });
            if (finalScoresList) {
                finalScoresArr.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const listItem = document.createElement("tr");
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td>${scoreData.score}</td>
                        <td>${scoreData.grade}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    finalScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable4' not found.");
            }
        } else {
            console.log("No final mode high scores available.");
        }

        if (masterSnapshot.exists()) {
            const masterScoresObj = masterSnapshot.val();
            const masterScoresList = document.querySelector("#scoreTable3");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const masterScoresArr = Object.values(masterScoresObj).sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return parseTime(a.time) - parseTime(b.time); // Sort by time in ascending order if scores are equal
                }
            });
            if (masterScoresList) {
                masterScoresArr.forEach((scoreData, index) => {
                    const rank = index + 1;
                    const listItem = document.createElement("tr");
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td>${scoreData.score}</td>
                        <td>${scoreData.grade}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    masterScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable3' not found.");
            }
        } else {
            console.log("No master mode high scores available.");
        }
    } catch (error) {
        console.error("Error fetching high scores:", error);
    }
});
