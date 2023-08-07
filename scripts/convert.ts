#!/usr/bin/env ts-node

import axios from "axios";
import * as cheerio from "cheerio";

const DEFAULT_COLOR_SCHEMES_MANAGER_URL = "https://raw.githubusercontent.com/JetBrains/intellij-community/master/platform/platform-resources/src/DefaultColorSchemesManager.xml";

// https://github.com/JetBrains/colorSchemeTool

interface OptionWithMultipleValues {
    name: string;
    value: OptionWithSingleValue[];
}

interface OptionWithSingleValue {
    name: OptionValueName;
    value?: string;
    deuteranopia?: string;
    protanopia?: string;
}

enum OptionValueName {
    FOREGROUND = "FOREGROUND",
    BACKGROUND = "BACKGROUND",
    FONT_TYPE = "FONT_TYPE",
    EFFECT_COLOR = "EFFECT_COLOR",
    EFFECT_TYPE = "EFFECT_TYPE"
}

interface Scheme {
    parentSchemeName: string;
    name: string;
    colors: OptionWithSingleValue[];
    attributes: OptionWithMultipleValues[];
}

function parseXmlScheme(xml: string): Scheme[] {
    const schemes: Scheme[] = [];

    const $ = cheerio.load(xml);
    const xmlSchemes = $("scheme");

    for (const xmlScheme of xmlSchemes) {
        const xmlSchemeElement = $(xmlScheme);
        const scheme: Scheme = {
            name: xmlSchemeElement.attr("name"),
            parentSchemeName: xmlSchemeElement.attr("parent_scheme")?.toString() ?? null,
            colors: [],
            attributes: []
        };

        const xmlColorsOptions = $("colors option", xmlScheme);
        for (const xmlColorOption of xmlColorsOptions) {
            const xmlColorOptionElement = $(xmlColorOption);
            const color: OptionWithSingleValue = {
                name: xmlColorOptionElement.attr("name").toString() as OptionValueName,
                value: xmlColorOptionElement.attr("value").toString(),
                deuteranopia: xmlColorOptionElement.attr("deuteranopia")?.toString() ?? null,
                protanopia: xmlColorOptionElement.attr("protanopia")?.toString() ?? null
            };
            scheme.colors.push(color);
        }

        const xmlAttributesOptions = $("attributes option", xmlScheme);
        for (const xmlAttributesOption of xmlAttributesOptions) {
            const xmlColorOptionElement = $(xmlAttributesOption);

            const attribute: OptionWithMultipleValues = {
                name: xmlColorOptionElement.attr("name").toString(),
                value: []
            };

            const xmlAttributeOptions = $("value option", xmlColorOptionElement);
            for (const xmlAttributeOption of xmlAttributeOptions) {
                const xmlAttributeOptionElement = $(xmlAttributeOption);
                const attributeValueOption: OptionWithSingleValue = {
                    name: xmlAttributeOptionElement.attr("name").toString() as OptionValueName,
                    value: xmlAttributeOptionElement.attr("value").toString(),
                    deuteranopia: xmlAttributeOptionElement.attr("deuteranopia")?.toString() ?? null,
                    protanopia: xmlAttributeOptionElement.attr("protanopia")?.toString() ?? null
                };

                attribute.value.push(attributeValueOption);
            }
            scheme.attributes.push(attribute);
        }

        schemes.push(scheme);
    }

    return schemes;
}

function mergeSchemes(parent: Scheme, child: Scheme): Scheme {
    const result: Scheme = { name: child.name, parentSchemeName: child.parentSchemeName, colors: structuredClone(parent.colors), attributes: structuredClone(parent.attributes) };

    for (const childColor of child.colors) {
        const colorFromParent = result.colors.find(x => x.name === childColor.name);

        if (!colorFromParent) {
            result.colors.push(childColor);
        } else {
            if (childColor.value) {
                colorFromParent.value = childColor.value;
            }
            if (childColor.deuteranopia) {
                colorFromParent.deuteranopia = childColor.deuteranopia;
            }
            if (childColor.protanopia) {
                colorFromParent.protanopia = childColor.protanopia;
            }
        }
    }

    for (const childAttribute of child.attributes) {
        const attributeFromParent = result.attributes.find(x => x.name === childAttribute.name);

        if (!attributeFromParent) {
            result.attributes.push(childAttribute);
        } else {
            for (const childAttributeValue of childAttribute.value) {
                const attributeValueFromParent = attributeFromParent.value.find(x => x.name === childAttributeValue.name);
                if (!attributeValueFromParent) {
                    attributeFromParent.value.push(childAttributeValue);
                } else {
                    if (childAttributeValue.value) {
                        attributeValueFromParent.value = childAttributeValue.value;
                    }
                    if (childAttributeValue.deuteranopia) {
                        attributeValueFromParent.deuteranopia = childAttributeValue.deuteranopia;
                    }
                    if (childAttributeValue.protanopia) {
                        attributeValueFromParent.protanopia = childAttributeValue.protanopia;
                    }
                }
            }
        }
    }

    return result;
}

function getScheme(name: string, schemes: Scheme[]): Scheme {
    const scheme = schemes.find(x => x.name === name);
    if (scheme.parentSchemeName) {
        const parentScheme = schemes.find(x => x.name === scheme.parentSchemeName);
        return parentScheme ? mergeSchemes(parentScheme, scheme) : scheme;
    } else {
        return scheme;
    }
}

async function main() {
    const response = await axios.get(DEFAULT_COLOR_SCHEMES_MANAGER_URL);
    const xml = response.data;

    const schemes = parseXmlScheme(xml);
    const darcula = getScheme("Darcula", schemes);

    console.log(JSON.stringify(darcula, null, 2));
}

main();
