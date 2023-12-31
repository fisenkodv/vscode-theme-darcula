#!/usr/bin/env ts-node

import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs';
import path from 'path';

const DEFAULT_COLOR_SCHEMES_MANAGER_URL = 'https://raw.githubusercontent.com/JetBrains/intellij-community/master/platform/platform-resources/src/DefaultColorSchemesManager.xml';

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
  FOREGROUND = 'FOREGROUND',
  BACKGROUND = 'BACKGROUND',
  FONT_TYPE = 'FONT_TYPE',
  EFFECT_COLOR = 'EFFECT_COLOR',
  EFFECT_TYPE = 'EFFECT_TYPE'
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
  const xmlSchemes = $('scheme');

  for (const xmlScheme of xmlSchemes) {
    const xmlSchemeElement = $(xmlScheme);
    const scheme: Scheme = {
      name: xmlSchemeElement.attr('name'),
      parentSchemeName: xmlSchemeElement.attr('parent_scheme') ?? null,
      colors: [],
      attributes: []
    };

    const xmlColorsOptions = $('colors option', xmlScheme);
    for (const xmlColorOption of xmlColorsOptions) {
      const xmlColorOptionElement = $(xmlColorOption);
      const color: OptionWithSingleValue = {
        name: xmlColorOptionElement.attr('name') as OptionValueName,
        value: xmlColorOptionElement.attr('value'),
        deuteranopia: xmlColorOptionElement.attr('deuteranopia') ?? null,
        protanopia: xmlColorOptionElement.attr('protanopia') ?? null
      };
      scheme.colors.push(color);
    }

    const xmlAttributesOptions = $('attributes > option', xmlScheme);
    for (const xmlAttributesOption of xmlAttributesOptions) {
      const xmlColorOptionElement = $(xmlAttributesOption);

      const attribute: OptionWithMultipleValues = {
        name: xmlColorOptionElement.attr('name'),
        value: []
      };

      const xmlAttributeOptions = $('value option', xmlColorOptionElement);
      for (const xmlAttributeOption of xmlAttributeOptions) {
        const xmlAttributeOptionElement = $(xmlAttributeOption);
        const attributeValueOption: OptionWithSingleValue = {
          name: xmlAttributeOptionElement.attr('name') as OptionValueName,
          value: xmlAttributeOptionElement.attr('value')?.trim(),
          deuteranopia: xmlAttributeOptionElement.attr('deuteranopia') ?? null,
          protanopia: xmlAttributeOptionElement.attr('protanopia') ?? null
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

function mapToTheme(scheme: Scheme) {
  const mappings = JSON.parse(fs.readFileSync(path.resolve(path.join('./scripts', 'mapping.json')), 'utf-8')) as {
    editor: Record<string, string>;
    syntax: { attribute_name: string; color?: string; scope: string }[];
  };

  const theme = { type: 'dark', name: 'Darcula', semanticHighlighting: true, colors: mappings.editor, tokenColors: [] };

  for (const mapping of mappings.syntax) {
    const attribute = scheme.attributes.find(x => x.name === mapping.attribute_name);
    if (attribute) {
      const foregroundValue = attribute.value.find(x => x.name === OptionValueName.FOREGROUND);
      const fontTypeValue = attribute.value.find(x => x.name === OptionValueName.FONT_TYPE);

      if (foregroundValue) {
        const token = {
          scope: mapping.scope,
          settings: {
            foreground: mapping.color ? `#${mapping.color}` : `#${foregroundValue.protanopia ?? foregroundValue.value}`,
            fontStyle: fontTypeValue?.protanopia ?? fontTypeValue?.deuteranopia ?? ''
          }
        };
        theme.tokenColors.push(token);
      }
    }
  }

  return theme;
}

async function main() {
  const response = await axios.get(DEFAULT_COLOR_SCHEMES_MANAGER_URL);
  const xml = response.data;

  const schemes = parseXmlScheme(xml);
  const darcula = getScheme('Darcula', schemes);
  const theme = mapToTheme(darcula);

  fs.writeFileSync('./themes/darcula.json', JSON.stringify(theme, null, 2));
}

main();
