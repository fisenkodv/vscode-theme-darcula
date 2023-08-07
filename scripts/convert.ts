#!/usr/bin/env ts-node

import axios from "axios";
import * as cheerio from "cheerio";

const DEFAULT_COLOR_SCHEMES_MANAGER_URL = "https://raw.githubusercontent.com/JetBrains/intellij-community/master/platform/platform-resources/src/DefaultColorSchemesManager.xml";

// https://github.com/JetBrains/colorSchemeTool

interface Option {
    name: string;
    value: OptionValue[];
}

interface OptionValue {
    name: OptionValueName;
    value?: string;
    deuteranopia?: string;
    protanopia?: string;
}

enum OptionValueName {
    FOREGROUND,
    BACKGROUND,
    FONT_TYPE,
    EFFECT_COLOR,
    EFFECT_TYPE
}

interface Scheme {
    name: string;
    colors: OptionValue[];
    attributes: Option[];
}

function loadScheme(xml: string, name: string): Scheme {}

function map(scheme: Scheme) {}

async function main() {
    const response = await axios.get(DEFAULT_COLOR_SCHEMES_MANAGER_URL);
    const xml = response.data;
    const $ = cheerio.load(xml);

    console.log($("scheme[name='Darcula'] colors option").length);
}

main();
