let lastQuestion = "";
let recognition = null;
let voiceEnabled = true;
// =================================
// Helpers
// =================================

function getCurrentTime() {

    return new Date().toLocaleTimeString(
        [],
        {
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function scrollToBottom() {

    const chat =
        document.getElementById("chat");

    if (chat) {

        chat.scrollTop =
            chat.scrollHeight;
    }
}

// =================================
// Initialize
// =================================

window.onload = function () {

    const question =
        document.getElementById(
            "question"
        );

    if (question) {

        question.addEventListener(
            "keydown",
            function (e) {

                if (
                    e.key === "Enter" &&
                    !e.shiftKey
                ) {

                    e.preventDefault();

                    sendMessage();
                }
            }
        );
    }
};

// =================================
// Login
// =================================

async function login() {

    const username =
        document.getElementById(
            "username"
        ).value;

    const password =
        document.getElementById(
            "password"
        ).value;

    try {

        const response =
            await fetch(
                "/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            username,
                            password
                        })
                }
            );

        const result =
            await response.json();

        if (result.success) {

            lastQuestion = "";

            document.getElementById("chat").innerHTML = "";
            document.getElementById("chat").scrollTop = 0;

            document.getElementById(
                "loginSection"
            ).style.display = "none";

            document.getElementById(
                "chatSection"
            ).style.display = "flex";

            document.getElementById("chat").innerHTML = `
    <div class="bot">
        <div style="
            font-weight:600;
            color:#28A745;
            margin-bottom:10px;">
            🤖 AI Assistant
        </div>

        <div>
            👋 Welcome to Brother AI Warranty Assistant!<br><br>
            Ask me about warranties using Serial Number, BP Number,
            Equipment ID, Warranty ID, Model, Country, or Created Date.
        </div>

        <div style="
            font-size:12px;
            opacity:.75;
            margin-top:8px;">
            ${getCurrentTime()}
        </div>
    </div>
`;
            ``

            loadDashboardData();

        } else {

            document.getElementById(
                "loginMessage"
            ).innerHTML =
                "You have entered a wrong User Id or Password. Please enter the valid Credentials.";

            document.getElementById(
                "loginMessage"
            ).className =
                "error";
        }

    } catch {

        document.getElementById(
            "loginMessage"
        ).innerHTML =
            "Unable to connect to server";

        document.getElementById(
            "loginMessage"
        ).className =
            "error";
    }
}

// =================================
// Send Message
// =================================

async function sendMessage() {

    const input =
        document.getElementById(
            "question"
        );

    const question =
        input.value.trim();

    if (question) {

        lastQuestion =
            question;
    }

    const searchQuestion =
        question ||
        lastQuestion;

    if (!searchQuestion)
        return;

    const chat =
        document.getElementById(
            "chat"
        );

    // =================================
    // User Bubble
    // =================================

    chat.innerHTML += `
        <div class="user">

            <div style="
                font-weight:600;
                margin-bottom:6px;">

                You

            </div>

            <div>

                ${searchQuestion}

            </div>

            <div style="
                font-size:12px;
                opacity:.75;
                margin-top:8px;">

                ${getCurrentTime()}

            </div>

        </div>
    `;

    input.value = "";

    input.focus();

    scrollToBottom();

    // =================================
    // Loading Message
    // =================================

    const loadingId =
        "loading_" +
        Date.now();

    chat.innerHTML += `
        <div
            id="${loadingId}"
            class="bot">

            <div style="
                font-weight:600;
                color:#28A745;
                margin-bottom:10px;">

                🤖 AI Assistant

            </div>

            <div>

                Searching warranty information...

            </div>

        </div>
    `;

    scrollToBottom();

    try {

        const response =
            await fetch(
                "/chat",
                {
                    method: "POST",
                    headers: {
                        "Content-Type":
                            "application/json"
                    },
                    body:
                        JSON.stringify({
                            question:
                                searchQuestion
                        })
                }
            );

        if (response.status === 401) {

            const loading =
                document.getElementById(
                    loadingId
                );

            if (loading) {
                loading.remove();
            }

            chat.innerHTML += `
        <div class="bot">

            <div style="
                font-weight:600;
                color:#dc3545;
                margin-bottom:10px;">

                🔒 AI Assistant

            </div>

            <div>

                Your session has expired.
                Redirecting to login page...

            </div>

        </div>
    `;
            scrollToBottom();

            setTimeout(() => {
                location.reload();
            }, 2000);

            return;
        }

        const result =
            await response.json();

        const loading =
            document.getElementById(
                loadingId
            );

        if (loading) {

            loading.remove();
        }

        let botResponse = `
            <div class="bot">

                <div style="
                    font-weight:600;
                    color:#28A745;
                    margin-bottom:10px;">

                    🤖 AI Assistant

                </div>

                <div>

                    ${result.answer}

                </div>
        `;

        // =================================
        // Record Count
        // =================================

        if (
            result.totalRecords
        ) {

            botResponse += `
                <div style="
                    margin-top:15px;
                    background:#EAF4FF;
                    padding:10px;
                    border-radius:8px;
                    font-weight:600;
                    color:#0057B8;">

                    Records Found:
                    ${result.totalRecords}

                </div>
            `;
        }

        // =================================
        // Details Section
        // =================================

        if (result.details) {

            const detailsId =
                "details_" +
                Date.now();

            botResponse += `
                <div
                    style="
                        margin-top:15px;">

                    <button
                        onclick="
                            toggleDetails(
                                '${detailsId}',
                                this
                            )"
                        style="
                            background:#0078D4;
                            color:white;
                            border:none;
                            padding:10px 16px;
                            border-radius:8px;
                            cursor:pointer;
                            font-weight:600;">

                        Show Details ▼

                    </button>

                </div>

                <div
                    id="${detailsId}"
                    style="
                        display:none;
                        margin-top:15px;">
                         
                 <div class="top-scroll">
                 <div class="top-scroll-inner">
                 </div>
                 </div>
                 <div class="table-scroll">

            `;

            // =================================
            // Multiple Records
            // =================================

            if (
                Array.isArray(
                    result.details
                )
            ) {

                botResponse += `
                    <table
                        style="
                            width:max-content;
                            min-width:2200px;
                            border-collapse:collapse;
                            background:white;">

                    <tr>
                        <th>BP Number</th>
                        <th>Equipment</th>
                        <th>Serial</th>
                        <th>Model</th>
                        <th>Country</th>
                        <th>Warranty ID</th>
                        <th>Warranty Type</th>
                        <th>Warranty Description</th>
                        <th>Purchase Date</th>
                        <th>Cont Start Date</th>
                        <th>Cont End Date</th>
                        <th>Cont Created Date</th>
                    </tr>
                `;
                // =================================
                // Single Record
                // =================================
                result.details.forEach(
                    row => {

                        botResponse += `
                        <tr>
                            <td>${row.BPNumber || ""}</td>
                            <td>${row.Equipment || ""}</td>
                            <td>${row.Serial || ""}</td>
                            <td>${row.Model || ""}</td>
                            <td>${row.Country || ""}</td>
                            <td>${row.WarrantyId || ""}</td>
                            <td>${row.WarrantyType || ""}</td>
                            <td>${row.WarrantyDisc || ""}</td>
                            <td>${row.PurchaseDate || ""}</td>
                            <td>${row.ContStartDate || ""}</td>
                            <td>${row.ContEndDate || ""}</td>
                            <td>${row.ContCreatedDate || ""}</td>
                        </tr>
                    `;
                    });

                botResponse += `
                    </table>
                `;

            } else {

                botResponse += `
                    <table
                        style="
                            width:100%;
                            border-collapse:collapse;
                            background:white;">

                    <tr>
                        <th>Field</th>
                        <th>Value</th>
                    </tr>
                `;

                Object.entries(
                    result.details
                ).forEach(
                    ([key, value]) => {

                        botResponse += `
                        <tr>
                            <td>${key}</td>
                            <td>${value || ""}</td>
                        </tr>
                    `;
                    });

                botResponse += `
                    </table>
                `;
            }

            botResponse += `
                </div>
                </div>
            `;
        }

        botResponse += `
            </div>
        `;

        chat.innerHTML +=
            botResponse;

        if (result.answer) {
            speakResponse(result.answer);
        }

        setTimeout(() => {

            document
                .querySelectorAll(".top-scroll")
                .forEach(topScroll => {

                    const container =
                        topScroll.parentElement;

                    const tableScroll =
                        container.querySelector(".table-scroll");

                    const inner =
                        topScroll.querySelector(".top-scroll-inner");

                    if (!tableScroll) return;

                    inner.style.width = "5000px";

                    topScroll.addEventListener("scroll", () => {
                        tableScroll.scrollLeft =
                            topScroll.scrollLeft;
                    });

                    tableScroll.addEventListener("scroll", () => {
                        topScroll.scrollLeft =
                            tableScroll.scrollLeft;
                    });

                });

        }, 100);

        scrollToBottom();

    } catch (error) {

        const loading =
            document.getElementById(
                loadingId
            );

        if (loading) {
            loading.remove();
        }

        chat.innerHTML += `
            <div class="bot">

                <div style="
                    color:red;
                    font-weight:600;
                    margin-bottom:8px;">

                    ⚠ AI Assistant

                </div>

                <div>

                    Unable to connect to server.

                    Please try again.

                </div>

            </div>
        `;

        scrollToBottom();
    }
}

// =================================
// Toggle Details
// =================================

function toggleDetails(
    id,
    btn
) {

    const section =
        document.getElementById(
            id
        );

    if (
        section.style.display ===
        "none"
    ) {

        section.style.display =
            "block";

        btn.innerText =
            "Hide Details ▲";

    } else {

        section.style.display =
            "none";

        btn.innerText =
            "Show Details ▼";
    }
}
// =================================
// Voice
// =================================
function startVoiceSearch() {

    const SpeechRecognition =
        window.SpeechRecognition ||
        window.webkitSpeechRecognition;

    if (!SpeechRecognition) {

        alert(
            "Voice recognition is not supported in this browser. Please use Microsoft Edge or Google Chrome."
        );
        return;
    }

    if (!recognition) {

        recognition =
            new SpeechRecognition();

        recognition.lang = "en-US";
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onresult = function (event) {

            const transcript =
                event.results[0][0].transcript;

            document.getElementById(
                "question"
            ).value = transcript;

            document
                .getElementById("voiceBtn")
                .classList.remove(
                    "listening"
                );

            sendMessage();
        };

        recognition.onerror = function (event) {

            document
                .getElementById("voiceBtn")
                .classList.remove(
                    "listening"
                );

            alert(
                "Voice recognition error: " +
                event.error
            );
        };

        recognition.onend = function () {

            document
                .getElementById("voiceBtn")
                .classList.remove(
                    "listening"
                );
        };
    }

    document
        .getElementById("voiceBtn")
        .classList.add(
            "listening"
        );
    // Stop any AI speech before listening
    window.speechSynthesis.cancel();

    recognition.start();
}

function toggleVoice() {

    voiceEnabled = !voiceEnabled;

    document.getElementById(
        "speakerBtn"
    ).innerText =
        voiceEnabled ? "🔊" : "🔇";

    if (!voiceEnabled) {
        window.speechSynthesis.cancel();
    }
}

function speakResponse(text) {

    if (!voiceEnabled) {
        return;
    }

    if (!window.speechSynthesis) {
        return;
    }

    const speech =
        new SpeechSynthesisUtterance(text);

    speech.lang = "en-US";
    speech.rate = 1;
    speech.pitch = 1;

    window.speechSynthesis.cancel();

    window.speechSynthesis.speak(speech);
}