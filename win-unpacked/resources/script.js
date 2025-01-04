const { ipcRenderer } = require("electron");

class Widget {
    constructor(
        SourceURL,
        type,
        data,
        properties = {
            cursor: "default",
        }
    ) {
        this.elements = {};

        this.elements.Box = document.createElement("div");
        this.elements.Box.classList.add("widget");

        document.getElementById(type).appendChild(this.elements.Box);

        this.elements.image = document.createElement("img");
        this.elements.image.src = SourceURL;
        this.elements.Box.appendChild(this.elements.image);

        this.elements.titles = [];

        for (const name in data) {
            let newTitle = null;

            newTitle = document.createElement("h3");
            if (data[name][2])
                newTitle.innerHTML = data[name][1] ? `${name}: ${data[name][0]}` : data[name][0];
            this.elements.Box.appendChild(newTitle);

            this.elements.titles.push(newTitle);
        }

        for (const name in properties) {
            const value = properties[name];

            switch (name) {
                case "size":
                    const dimensions = value.split("|");

                    this.elements.Box.style.maxWidth = dimensions[0];
                    this.elements.Box.style.maxHeight = dimensions[1];

                    this.elements.Box.style.width = dimensions[0];
                    this.elements.Box.style.height = dimensions[1];
                    break;

                case "cursor":
                    this.elements.Box.style.cursor = value;
                    break;

                case "onclick":
                    this.elements.Box.onclick = function () {
                        value.callback(data[value.returnvalue][0], this.elements);
                    };
                    break;

                default:
                    break;
            }
        }
    }
}

function downloadTxt(content, fileName) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);

    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
}

function uploadTxt(callback) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt";

    input.onclick = function () {
        [...document.querySelectorAll("input[type='file']")].forEach((__input) => {
            if (__input.id.length == 0) __input.remove();
        });
    };

    input.addEventListener("change", function (event) {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();

            reader.onload = function (e) {
                callback(e.target.result);
            };

            reader.readAsText(file);
        }
    });

    document.body.appendChild(input);
    input.click();
}

function addModel() {
    const selectModelWD = document.querySelector("#select");
    const createModelWD = document.querySelector("#create");

    selectModelWD.style.display = "none";
    createModelWD.style.display = "flex";

    const image_input = document.querySelector("#getImage");
    const name_input = document.querySelector("#getName");
    const data_input = document.querySelector("#getData");
    const import_btn = document.querySelector("#importModel");
    const export_btn = document.querySelector("#exportModel");
    const create_btn = document.querySelector("#createModel");
    const cancel_btn = document.querySelector("#cancelModel");
    let send_after_load = false;
    let image_loaded = false;
    let data = {};

    function send() {
        data.name = name_input.value;
        data.data = data_input.value;

        ipcRenderer.send("upload-model", data);

        selectModelWD.style.display = "block";
        createModelWD.style.display = "none";
    }

    image_input.addEventListener("change", function (event) {
        const file = event.target.files[0];

        if (file) {
            const reader = new FileReader();

            const spinner = document.createElement("spinner");
            image_input.parentNode.appendChild(spinner);
            image_loaded = false;

            reader.onloadend = () => {
                data.base64data = reader.result;
                document.getElementById("preview").src = data.base64data;

                spinner.remove();
                image_loaded = true;
                if (send_after_load) send();
            };

            reader.readAsDataURL(file);
        }
    });
    create_btn.onclick = function () {
        if (image_loaded) send();
        else send_after_load = true;
    };
    cancel_btn.onclick = function () {
        data.name = "";
        data.data = "";
        send_after_load = false;

        selectModelWD.style.display = "block";
        createModelWD.style.display = "none";
    };
    export_btn.onclick = function () {
        data.name = name_input.value;
        data.data = data_input.value;

        const outputData = JSON.stringify(data).replaceAll("\n", "");
        downloadTxt(outputData, "Model.txt");
    };
    import_btn.onclick = function () {
        [...document.querySelectorAll("input[type='file']")].forEach((__input) => {
            if (__input.id.length == 0) __input.remove();
        });

        uploadTxt(function (inputData) {
            data = JSON.parse(inputData);

            name_input.value = data.name;
            data_input.value = data.data;
            document.getElementById("preview").src = data.base64data;
            image_loaded = true;
        });
    };
}

let choosenModel = false;
const paths = {};

ipcRenderer.on("paths", (event, value) => {
    for (const key in value) {
        paths[key] = value[key];
    }
});

ipcRenderer.on("Models", (event, value) => {
    document.getElementById("models").innerHTML = "";
    const Models = value.Models;

    Models.forEach((MODEL) => {
        const widget = new Widget(
            MODEL.Source,
            "models",
            {
                Nom: [MODEL.Name, false, true],
                Desc: [
                    `${MODEL.Description.inside_dimensions.x}x${MODEL.Description.inside_dimensions.y},${MODEL.Description.outside_dimensions.x}x${MODEL.Description.outside_dimensions.y}`,
                    false,
                    true,
                ],
                Fichier: [MODEL.fileName, false, false],
            },
            {
                size: "calc(33% - 39px)|45%",
                cursor: "pointer",
                onclick: {
                    callback: function (name, elements) {
                        choosenModel = name;

                        [...document.querySelectorAll(".widget")].forEach((Box) => {
                            Box.style.removeProperty("box-shadow");
                        });
                        widget.elements.Box.style.boxShadow = "white 0px 0px 0px 4px";
                    },
                    returnvalue: "Fichier",
                },
            }
        );

        const deleteBtn = document.createElement("img");
        deleteBtn.classList.add("delete-icon");
        deleteBtn.src = paths.deleteIcon;
        widget.elements.Box.appendChild(deleteBtn);

        const Source = MODEL.fileName;
        deleteBtn.onclick = function () {
            if (confirm("Êtes-vous sûr de vouloir supprimer ce modèle ?"))
                ipcRenderer.send("remove-model", Source);
        };
    });
});

function valid() {
    const side_bar = document.querySelector("#sideBar");

    class sideOption {
        constructor(imageUrl, imageHoverUrl, onclick) {
            this.imageUrl = imageUrl;
            this.imageHoverUrl = imageHoverUrl;
            this.selected = false;
            this.active = true;
            this.data = {};

            this.image = document.createElement("img");
            this.image.classList.add("side-option");
            this.image.src = imageUrl;

            side_bar.appendChild(this.image);
            this.image.onclick = () => {
                if (this.active) {
                    this.selected = !this.selected;
                    this.update();
                    onclick(this);
                }
            };
        }

        update() {
            if (this.selected) this.image.src = this.imageHoverUrl;
            else this.image.src = this.imageUrl;
        }
    }

    if (choosenModel != false) {
        ipcRenderer.send("model-choice", choosenModel);
        document.getElementById("blur").style.display = "none";

        const options = [
            new sideOption(paths.x2Icon, paths.x2IconHover, function (option) {
                option.data.checked = !option.data.checked;
                ipcRenderer.send("checkbox-update", option.data.checked);
            }),
            new sideOption(paths.backIcon, paths.backIconHover, function (option) {
                option.active = false;

                document.getElementById("item").innerHTML = "";
                document.getElementById("mat").innerHTML = "";
                document.querySelector("#sideBar").innerHTML = "";

                document.getElementById("blur").style.display = "block";
            }),
        ];
    }
}

ipcRenderer.on("add-element", (event, value) => {
    new Widget(value.SourceURL, value.type, value.data);
});

ipcRenderer.on("clear", (event, value) => {
    document.getElementById("item").innerHTML = "";
    document.getElementById("mat").innerHTML = "";
});
