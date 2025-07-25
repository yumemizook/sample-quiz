import { getDatabase, ref, query, orderByChild, get } from "./firebase.js";

const db = getDatabase();
const highScoresRef = ref(db, 'scores');
const hellMode = ref(db, 'scoreshell');
const easyMode = ref(db, 'scoreseasy');
const finalMode = ref(db, 'scoresfinal');
const highScoresQuery = query(highScoresRef, orderByChild('score'));
const hellModeQuery = query(hellMode, orderByChild('score'));
const easyModeQuery = query(easyMode, orderByChild('score'));
const finalModeQuery = query(finalMode, orderByChild('score'));
document.addEventListener("DOMContentLoaded", async () => {
    try {
        const snapshot = await get(highScoresQuery);
        const hellSnapshot = await get(hellModeQuery);
        const easySnapshot = await get(easyModeQuery);
        const finalSnapshot = await get(finalModeQuery);
        if (snapshot.exists()) {
            const highScoresObj = snapshot.val();
            const highScoresList = document.querySelector("#scoreTable2");
            // Convert object to array and sort by score descending
            const highScoresArr = Object.values(highScoresObj).sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return a.time - b.time; // Sort by date in ascending order if scores are equal
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
            const easyScoresArr = Object.values(easyScoresObj).sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return a.time - b.time; // Sort by date in ascending order if scores are equal
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
            const finalScoresArr = Object.values(finalScoresObj).sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return a.time - b.time; // Sort by date in ascending order if scores are equal
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

        if (hellSnapshot.exists()) {
            const hellScoresObj = hellSnapshot.val();
            const hellScoresList = document.querySelector("#scoreTable3");
            // Convert object to array and sort by score descending
            const hellScoresArr = Object.values(hellScoresObj).sort((a, b) => {
                if (a.score !== b.score) {
                    return b.score - a.score; // Sort by score in descending order
                } else {
                    return a.time - b.time; // Sort by date in ascending order if scores are equal 
                }
            });
            if (hellScoresList) {
                hellScoresArr.forEach((scoreData, index) => {
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
                    hellScoresList.appendChild(listItem);
                });
            } else {
                console.warn("Element with ID 'scoreTable3' not found.");
            }
        } else {
            console.log("No hell mode high scores available.");
        }
    } catch (error) {
        console.error("Error fetching high scores:", error);
    }
});
