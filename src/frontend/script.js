const cliInput = document.querySelector("#cli-input");
let resultsElem = document.querySelector("#results");
const apiUrlPrefix = "http://localhost:8000";
let results = [];

let xmlHttp = new XMLHttpRequest();
xmlHttp.open("GET", `${apiUrlPrefix}/generic_Keywords`, true);
xmlHttp.onreadystatechange = function () {
  if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
    results = JSON.parse(xmlHttp.response);
};
xmlHttp.send();

function sendQuestion(body) {
  xmlHttp.open("GET", `${apiUrlPrefix}/ask_question?1=${body}`, true);
  xmlHttp.onreadystatechange = function () {
    if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
      results = JSON.parse(xmlHttp.response).keywords;
  };
  xmlHttp.send();
}

cliInput?.addEventListener("input", function (event) {
  setTimeout(() => {
    // @ts-ignore
    const value = event?.target?.value;

    const matches = results.filter((r) =>
      r.toLowerCase().includes(value.toLowerCase())
    );

    // @ts-ignore
    resultsElem.innerHTML = "";

    if (value != "") {
      for (let i = 0; i < matches.length; i++) {
        if (i < 5) {
          const elem = document.createElement("button");
          elem.innerText = matches[i];
          elem.addEventListener("click", function () {
            const clickedValue = this.innerText;
            sendQuestion(clickedValue);
            // @ts-ignore
            event.target.value = clickedValue;
          });
          resultsElem?.appendChild(elem);
        } else {
          break;
        }
      }
    }
  }, 500);
});
