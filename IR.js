import { getFirestore, collection, getDocs } from "./firebase.js";

const db = getFirestore();
const highScoresRef = collection(db, 'scoresnormal');
const masterModeRef = collection(db, 'scoresmaster');
const easyModeRef = collection(db, 'scoreseasy');
const finalModeRef = collection(db, 'scoresfinal');
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const snapshot = await getDocs(highScoresRef);
        const masterSnapshot = await getDocs(masterModeRef);
        const easySnapshot = await getDocs(easyModeRef);
        const finalSnapshot = await getDocs(finalModeRef);
        if (!snapshot.empty) {
            const highScoresArrRaw = snapshot.docs.map((doc) => doc.data());
            const highScoresList = document.querySelector("#scoreTable2");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const highScoresArr = highScoresArrRaw.sort((a, b) => {
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
                    const gradeDisplay = scoreData.grade 
                        ? `<span class="grade-badge">${scoreData.grade}</span>` 
                        : "-";
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td class="high-score">${scoreData.score}</td>
                        <td>${gradeDisplay}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    highScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable' not found.");
            }
        }
        if (!easySnapshot.empty) {
            const easyScoresArrRaw = easySnapshot.docs.map((doc) => doc.data());
            const easyScoresList = document.querySelector("#scoreTable");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const easyScoresArr = easyScoresArrRaw.sort((a, b) => {
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
                        <td class="high-score">${scoreData.score}</td>
                        <td>${scoreData.time}</td>
                        <td>${scoreData.date}</td>
                    `;
                    easyScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable' not found.");
            }
        }
        if (!finalSnapshot.empty) {
            const finalScoresArrRaw = finalSnapshot.docs.map((doc) => doc.data());
            const finalScoresList = document.querySelector("#scoreTable4");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const finalScoresArr = finalScoresArrRaw.sort((a, b) => {
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
                    const gradeDisplay = scoreData.grade 
                        ? `<span class="grade-badge">${scoreData.grade}</span>` 
                        : "-";
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td class="high-score">${scoreData.score}</td>
                        <td>${gradeDisplay}</td>
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

        if (!masterSnapshot.empty) {
            const masterScoresArrRaw = masterSnapshot.docs.map((doc) => doc.data());
            const masterScoresList = document.querySelector("#scoreTable3");
            // Convert object to array and sort by score descending
            const parseTime = (timeStr) => {
                if (!timeStr) return 0;
                const parts = timeStr.split(':');
                return parseInt(parts[0] || 0) * 60000 + parseInt(parts[1] || 0) * 1000 + parseInt(parts[2] || 0) * 10;
            };
            const masterScoresArr = masterScoresArrRaw.sort((a, b) => {
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
                    const gradeDisplay = scoreData.grade 
                        ? `<span class="grade-badge">${scoreData.grade}</span>` 
                        : "-";
                    listItem.innerHTML = `
                        <td>${rank}</td>
                        <td>${scoreData.name}</td>
                        <td class="high-score">${scoreData.score}</td>
                        <td>${gradeDisplay}</td>
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
