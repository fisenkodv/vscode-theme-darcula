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
                const attributeValueFromParent = new attributeFromParent.value.find(x => x.name === childAttributeValue.name);
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

class Attribute {
    constructor(
        ideaOptionName: string,
        parentAttribute: Attribute,
        options?: { scope?: string; background?: { r: number; g: number; b: number }; foreground?: { r: number; g: number; b: number }; font_style?: number }
    ) {}
}

function mapToTheme(scheme: Scheme) {
    const text = new Attribute("TEXT", null);
    // HighlighterColors
    const bad_character = new Attribute("BAD_CHARACTER", text, { scope: "invalid" });
    const matched_brace = new Attribute("MATCHED_BRACE_ATTRIBUTES", text, { background: { r: 153, g: 204, b: 255 } });
    const unmatched_brace = new Attribute("UNMATCHED_BRACE_ATTRIBUTES", text, { background: { r: 255, g: 220, b: 220 } });

    // DefaultLanguageHighlighterColors (MUST HAVE!)
    const default_identifier = new Attribute("DEFAULT_IDENTIFIER", text, { scope: "entity" });
    const default_number = new Attribute("DEFAULT_NUMBER", text, { scope: "constant.numeric" });
    const default_keyword = new Attribute("DEFAULT_KEYWORD", text, { scope: "keyword" });
    const default_string = new Attribute("DEFAULT_STRING", text, { scope: "string" });
    const default_block_comment = new Attribute("DEFAULT_BLOCK_COMMENT", text, { scope: "comment.block" });
    const default_line_comment = new Attribute("DEFAULT_LINE_COMMENT", text, { scope: "comment.line" });
    const default_doc_comment = new Attribute("DEFAULT_DOC_COMMENT", text, { scope: "comment.documentation" });
    const default_operation_sign = new Attribute("DEFAULT_OPERATION_SIGN", text, { scope: "keyword.operator" });
    const default_braces = new Attribute("DEFAULT_BRACES", text, { scope: "punctuation" });
    const default_dot = new Attribute("DEFAULT_DOT", text, { scope: "punctuation" });
    const default_semicolon = new Attribute("DEFAULT_SEMICOLON", text, { scope: "punctuation" });
    const default_comma = new Attribute("DEFAULT_COMMA", text, { scope: "punctuation" });
    const default_parentheses = new Attribute("DEFAULT_PARENTHS", text, { scope: "punctuation" });
    const default_brackets = new Attribute("DEFAULT_BRACKETS", text, { scope: "punctuation" });
    const default_label = new Attribute("DEFAULT_LABEL", default_identifier);
    const default_constant = new Attribute("DEFAULT_CONSTANT", default_identifier, { scope: "constant" });
    const default_local_variable = new Attribute("DEFAULT_LOCAL_VARIABLE", default_identifier, { scope: "variable" });
    const default_global_variable = new Attribute("DEFAULT_GLOBAL_VARIABLE", default_local_variable, { font_style: 2 });
    const default_function_declaration = new Attribute("DEFAULT_FUNCTION_DECLARATION", default_identifier, { scope: "entity.name.function" });
    const default_function_call = new Attribute("DEFAULT_FUNCTION_CALL", default_identifier, { scope: "support.function" });
    const default_parameter = new Attribute("DEFAULT_PARAMETER", default_identifier, { scope: "variable.parameter" });
    const default_class_name = new Attribute("DEFAULT_CLASS_NAME", default_identifier, { scope: "entity.name" });
    const default_interface_name = new Attribute("DEFAULT_INTERFACE_NAME", default_class_name);
    const default_instance_method = new Attribute("DEFAULT_INSTANCE_METHOD", default_function_declaration);
    const default_instance_field = new Attribute("DEFAULT_INSTANCE_FIELD", default_local_variable);
    const default_static_method = new Attribute("DEFAULT_STATIC_METHOD", default_function_declaration);
    const default_static_field = new Attribute("DEFAULT_STATIC_FIELD", default_global_variable);
    const default_doc_comment_markup = new Attribute("DEFAULT_DOC_MARKUP", default_doc_comment);
    const default_doc_comment_tag = new Attribute("DEFAULT_DOC_COMMENT_TAG", default_doc_comment);
    const default_valid_string_escape = new Attribute("DEFAULT_VALID_STRING_ESCAPE", text, { scope: "constant.character.escape" });
    const default_invalid_string_escape = new Attribute("DEFAULT_INVALID_STRING_ESCAPE", text, { scope: "invalid" });
    const default_predefined_symbol = new Attribute("DEFAULT_PREDEFINED_SYMBOL", default_identifier, { scope: "support.type" });
    const default_metadata = new Attribute("DEFAULT_METADATA", text, { scope: "meta.tag" });
    const default_markup_tag = new Attribute("DEFAULT_TAG", text, { scope: "punctuation.definition.tag" });
    const default_markup_attribute = new Attribute("DEFAULT_ATTRIBUTE", default_identifier, { scope: "entity.other.attribute-name" });
    const default_markup_entity = new Attribute("DEFAULT_ENTITY", default_identifier, { scope: "constant.character.entity" });
    const default_template_language = new Attribute("DEFAULT_TEMPLATE_LANGUAGE_COLOR", text, { scope: "text source" });

    // CodeInsightColors (Java)
    const java_local_variable = new Attribute("LOCAL_VARIABLE_ATTRIBUTES", text);
    const java_implicit_anonymous_class_parameter = new Attribute("IMPLICIT_ANONYMOUS_CLASS_PARAMETER_ATTRIBUTES", text);
    const java_instance_field = new Attribute("INSTANCE_FIELD_ATTRIBUTES", text);
    const java_static_field = new Attribute("STATIC_FIELD_ATTRIBUTES", text);
    const java_static_method = new Attribute("STATIC_METHOD_ATTRIBUTES", text);
    const java_parameter = new Attribute("PARAMETER_ATTRIBUTES", text);
    const java_class_name = new Attribute("CLASS_NAME_ATTRIBUTES", text);

    // SyntaxHighlighterColors (Java)
    const java_line_comment = new Attribute("JAVA_LINE_COMMENT", text, { scope: "comment.line" });
    const java_block_comment = new Attribute("JAVA_BLOCK_COMMENT", java_line_comment, { scope: "comment.block" });
    const java_doc_comment = new Attribute("JAVA_DOC_COMMENT", java_line_comment, { scope: "comment.documentation" });
    const java_keyword = new Attribute("JAVA_KEYWORD", text, { scope: "keyword" });
    const java_number = new Attribute("JAVA_NUMBER", text, { scope: "constant.numeric" });
    const java_string = new Attribute("JAVA_STRING", text, { scope: "string" });
    const java_opSign = new Attribute("JAVA_OPERATION_SIGN", text, { scope: "keyword.operator" });
    const java_parenths = new Attribute("JAVA_PARENTH", text, { scope: "punctuation" });
    const java_brackets = new Attribute("JAVA_BRACKETS", text, { scope: "punctuation" });
    const java_braces = new Attribute("JAVA_BRACES", text, { scope: "punctuation" });
    const java_comma = new Attribute("JAVA_COMMA", text, { scope: "punctuation" });
    const java_dot = new Attribute("JAVA_DOT", text, { scope: "punctuation" });
    const java_semicolon = new Attribute("JAVA_SEMICOLON", text, { scope: "punctuation" });
    const java_valid_string_escape = new Attribute("JAVA_VALID_STRING_ESCAPE", text, { scope: "constant.character.escape" });
    const java_invalid_string_escape = new Attribute("JAVA_INVALID_STRING_ESCAPE", text, { scope: "invalid" });
    const java_doc_comment_tag = new Attribute("JAVA_DOC_TAG", text);
    const java_doc_comment_markup = new Attribute("JAVA_DOC_MARKUP", text);

    // XmlHighlighterColors
    const xml_prologue = new Attribute("XML_PROLOGUE", text);
    const xml_tag = new Attribute("XML_TAG", text, { scope: "punctuation.definition.tag", background: { r: null, g: null, b: null } });
    const xml_attribute_name = new Attribute("XML_ATTRIBUTE_NAME", text, { scope: "entity.other.attribute-name.localname.xml" });
    const xml_tag_name = new Attribute("XML_TAG_NAME", text, { scope: "entity.name.tag.xml" });
    const xml_attribute_value = new Attribute("XML_ATTRIBUTE_VALUE", text, { scope: "string.quoted.double" });
    const xml_tag_data = new Attribute("XML_TAG_DATA", text);
    const xml_entity_reference = new Attribute("XML_ENTITY_REFERENCE", text, { scope: "constant.character.entity" });

    const html_comment = new Attribute("HTML_COMMENT", default_block_comment, { scope: "comment.block.html" });
    const html_tag = new Attribute("HTML_TAG", xml_tag, { scope: "punctuation.definition.tag", background: { r: null, g: null, b: null } });
    const html_tag_name = new Attribute("HTML_TAG_NAME", xml_tag_name, { scope: "entity.name.tag" });
    const html_attribute_name = new Attribute("HTML_ATTRIBUTE_NAME", xml_attribute_name, { scope: "entity.other.attribute-name.html" });
    const html_attribute_value = new Attribute("HTML_ATTRIBUTE_VALUE", xml_attribute_value);
    const html_entity_reference = new Attribute("HTML_ENTITY_REFERENCE", xml_entity_reference);

    // PyHighlighter
    const py_keyword = new Attribute("PY.KEYWORD", default_keyword, { scope: "storage.type" });
    const py_string = new Attribute("PY.STRING", default_string, { scope: "string.quoted" });
    const py_number = new Attribute("PY.NUMBER", default_number);
    const py_comment = new Attribute("PY.LINE_COMMENT", default_line_comment);
    const py_opSign = new Attribute("PY.OPERATION_SIGN", default_operation_sign);
    const py_parenths = new Attribute("PY.PARENTHS", default_parentheses);
    const py_brackets = new Attribute("PY.BRACKETS", default_brackets);
    const py_braces = new Attribute("PY.BRACES", default_braces);
    const py_comma = new Attribute("PY.COMMA", default_comma);
    const py_dot = new Attribute("PY.DOT", default_dot);
    const py_doc_comment = new Attribute("PY.DOC_COMMENT", default_doc_comment);

    const py_decorator = new Attribute("PY.DECORATOR", text, { scope: "entity.name.function.decorator" });
    const py_class_def = new Attribute("PY.CLASS_DEFINITION", text, { scope: "entity.name.class" });
    const py_func_def = new Attribute("PY.FUNC_DEFINITION", text, { scope: "entity.name.function" });
    // py_predef_def = new Attribute("PY.PREDEFINED_DEFINITION", text)  # scope???
    const py_predef_usage = new Attribute("PY.PREDEFINED_USAGE", text, { scope: "support.function" });
    const py_builtin_name = new Attribute("PY.BUILTIN_NAME", text, { scope: "support.function" });
    const py_valid_string_escape = new Attribute("PY.VALID_STRING_ESCAPE", default_valid_string_escape);
    const py_invalid_string_escape = new Attribute("PY.INVALID_STRING_ESCAPE", default_invalid_string_escape);

    // DjangoTemplateHighlighter
    const dj_comment = new Attribute("DJANGO_COMMENT", html_comment);
    const dj_tag_name = new Attribute("DJANGO_TAG_NAME", xml_tag_name);
    const dj_id = new Attribute("DJANGO_ID", xml_attribute_name);
    const dj_string_literal = new Attribute("DJANGO_STRING_LITERAL", xml_attribute_value);
    const dj_keyword = new Attribute("DJANGO_KEYWORD", default_keyword);
    const dj_number = new Attribute("DJANGO_NUMBER", default_number);
    const dj_tag_start_end = new Attribute("DJANGO_TAG_START_END", default_braces);
    const dj_filter = new Attribute("DJANGO_FILTER", default_braces, { scope: "support.function" });

    // Gql
    const gql_string_literal = new Attribute("GQL_STRING_LITERAL", default_string);
    const gql_keyword = new Attribute("GQL_KEYWORD", default_keyword);
    const gql_int_literal = new Attribute("GQL_INT_LITERAL", default_number);
    const gql_id = new Attribute("GQL_ID", default_number);

    // CSS
    const css_ident = new Attribute("CSS.IDENT", html_tag_name, { scope: "entity.other.attribute-name.class.css" });
    const css_comment = new Attribute("CSS.COMMENT", html_comment, { scope: "comment.block.css" });
    const css_property_name = new Attribute("CSS.PROPERTY_NAME", html_attribute_name, { scope: "support.type.property-name" });
    const css_property_value = new Attribute("CSS.PROPERTY_VALUE", html_attribute_value, { scope: "meta.property-value.css" });
    const css_tag_name = new Attribute("CSS.TAG_NAME", html_tag_name, { scope: "entity.name.tag.css" });
    const css_number = new Attribute("CSS.NUMBER", default_number, { scope: "constant.numeric.css" });
    const css_function = new Attribute("CSS.FUNCTION", html_tag_name, { scope: "support.function.misc.css" });
    const css_url = new Attribute("CSS.URL", html_attribute_value, { scope: "variable.parameter.misc.css" });

    // LESS
    const less_variable = new Attribute("LESS_VARIABLE", text, { scope: "variable.other.less" });
    const less_code_injection_delim = new Attribute("LESS_JS_CODE_DELIM", text, { scope: "source.css.less" });
    const less_code_injection = new Attribute("LESS_INJECTED_CODE", text, { scope: "source.js.embedded.less", foreground: { r: null, g: null, b: null } });

    // SASS
    const sass_identifier = new Attribute("SASS_IDENTIFIER", css_ident, { scope: "entity.other.attribute-name.class.css" });
    const sass_variable = new Attribute("SASS_VARIABLE", text, { scope: "variable.parameter.sass" });
    const sass_string = new Attribute("SASS_STRING", default_string, { scope: "string.quoted.double.css" });
    const sass_extend = new Attribute("SASS_EXTEND", default_keyword, { scope: "keyword.control.at-rule.css" });
    const sass_keyword = new Attribute("SASS_KEYWORD", default_keyword, { scope: "keyword.control.at-rule.css" });
    const sass_important = new Attribute("SASS_IMPORTANT", default_keyword, { scope: "keyword.control.at-rule.css" });
    const sass_default = new Attribute("SASS_DEFAULT", default_keyword, { scope: "keyword.control.at-rule.css" });
    const sass_property_name = new Attribute("SASS_PROPERTY_NAME", css_property_name, { scope: "support.type.property-name.css" });
    const sass_property_value = new Attribute("SASS_PROPERTY_VALUE", css_property_value, { scope: "support.constant.property-value.css" });
    const sass_tag_name = new Attribute("SASS_TAG_NAME", css_tag_name, { scope: "meta.selector.css entity.name.tag" });
    const sass_function = new Attribute("SASS_FUNCTION", css_function, { scope: "support.constant.property-value.css" });
    const sass_url = new Attribute("SASS_URL", css_url, { scope: "support.constant.property-value.css" });
    const sass_mixin = new Attribute("SASS_MIXIN", default_keyword, { scope: "entity.other.attribute-name.tag" });
    const sass_comment = new Attribute("SASS_COMMENT", default_block_comment, { scope: "comment.block.css" });
    const sass_number = new Attribute("SASS_NUMBER", default_number, { scope: "constant.numeric.css" });

    // JS
    const js_regexp = new Attribute("JS.REGEXP", default_string, { scope: "string.regexp" });
    const js_local_var = new Attribute("JS.LOCAL_VARIABLE", default_local_variable);
    const js_global_var = new Attribute("JS.GLOBAL_VARIABLE", default_global_variable);
    const js_parameter = new Attribute("JS.PARAMETER", default_parameter, { scope: "variable.parameter" });
    const js_instance_member_func = new Attribute("JS.INSTANCE_MEMBER_FUNCTION", default_instance_method);

    // YAML
    const yaml_comment = new Attribute("YAML_COMMENT", default_line_comment, { scope: "comment.line.number-sign.yaml" });
    const yaml_scalar_key = new Attribute("YAML_SCALAR_KEY", default_keyword, { scope: "entity.name.tag.yaml" });
    const yaml_scalar_value = new Attribute("YAML_SCALAR_VALUE", text, { scope: "string.unquoted.block.yaml" });
    const yaml_scalar_string = new Attribute("YAML_SCALAR_STRING", text, { scope: "string.quoted.single.yaml" });
    const yaml_scalar_dstring = new Attribute("YAML_SCALAR_DSTRING", text, { scope: "string.quoted.double.yaml" });
    const yaml_scalar_list = new Attribute("YAML_SCALAR_LIST", text, { scope: "string.unquoted.block.yaml" });
    const yaml_text = new Attribute("YAML_TEXT", text, { scope: "string.unquoted.yaml" });
    const yaml_sign = new Attribute("YAML_SIGN", default_operation_sign);

    // Puppet
    const puppet_comment = new Attribute("PUPPET_BLOCK_COMMENT", default_line_comment, { scope: "comment.block.puppet" });
    const puppet_regex = new Attribute("PUPPET_REGEX", default_string, { scope: "string.regexp" });
    const puppet_variable = new Attribute("PUPPET_VARIABLE", default_local_variable, { scope: "punctuation.definition.variable.puppet" });
    const puppet_variable_interpolation = new Attribute("PUPPET_VARIABLE_INTERPOLATION", default_string, { scope: "string source" });
    const puppet_escape_sequence = new Attribute("PUPPET_ESCAPE_SEQUENCE", default_valid_string_escape);
    const puppet_resource_reference = new Attribute("PUPPET_RESOURCE_REFERENCE", text);
    const puppet_keyword = new Attribute("PUPPET_KEYWORD", default_keyword, { scope: "keyword.control.puppet" });
    const puppet_digit = new Attribute("PUPPET_NUMBER", default_number);
    const puppet_dq_string = new Attribute("PUPPET_STRING", default_string, { scope: "string.quoted.double.puppet" });
    const puppet_sq_string = new Attribute("PUPPET_SQ_STRING", default_string, { scope: "string.quoted.single.puppet" });
    const puppet_operation_sign = new Attribute("PUPPET_OPERATION_SIGN", default_operation_sign, { scope: "keyword.operator.assignment.puppet" });
    const puppet_parenths = new Attribute("PUPPET_PARENTH", default_parentheses, { scope: "punctuation.section.scope.puppet" });
    const puppet_brackets = new Attribute("PUPPET_BRACKETS", default_brackets, { scope: "punctuation.definition.array.begin.puppet" });
    const puppet_braces = new Attribute("PUPPET_BRACES", default_braces, { scope: "punctuation.section.scope.puppet" });
    const puppet_comma = new Attribute("PUPPET_COMMA", default_comma);
    const puppet_dot = new Attribute("PUPPET_DOT", default_dot);
    const puppet_semicolon = new Attribute("PUPPET_SEMICOLON", default_semicolon);
    const puppet_bat_character = new Attribute("PUPPET_BAD_CHARACTER", bad_character);
    const puppet_class = new Attribute("PUPPET_CLASS", default_class_name, { scope: "entity.name.type.class.puppet" });

    // RubyHighlighter
    const rb_keyword = new Attribute("RUBY_KEYWORD", default_keyword);
    const rb_comment = new Attribute("RUBY_COMMENT", default_line_comment);
    const rb_heredoc_id = new Attribute("RUBY_HEREDOC_ID", default_string, { scope: "punctuation.definition.string.begin.ruby" });
    const rb_heredoc = new Attribute("RUBY_HEREDOC_CONTENT", default_string, { scope: "string.unquoted.heredoc.ruby" });
    const rb_number = new Attribute("RUBY_NUMBER", default_number);
    const rb_string = new Attribute("RUBY_STRING", default_string, { scope: "string.quoted.single.ruby" });
    const rb_interpolated_string = new Attribute("RUBY_INTERPOLATED_STRING", default_string, { scope: "string.quoted.double.ruby" });
    const rb_words = new Attribute("RUBY_WORDS", default_string, { scope: "string.quoted.other.literal.upper.ruby" });
    const rb_escape_sequence = new Attribute("RUBY_ESCAPE_SEQUENCE", default_valid_string_escape);
    const rb_invalid_escape_sequence = new Attribute("RUBY_INVALID_ESCAPE_SEQUENCE", default_invalid_string_escape);
    const rb_opSign = new Attribute("RUBY_OPERATION_SIGN", default_operation_sign);
    const rb_brackets = new Attribute("RUBY_BRACKETS", default_brackets);
    const rb_expr_in_string = new Attribute("RUBY_EXPR_IN_STRING", default_string, { scope: "string source" });
    const rb_bad_character = new Attribute("RUBY_BAD_CHARACTER", text, { scope: "invalid" });
    const rb_regexp = new Attribute("RUBY_REGEXP", default_string, { scope: "string.regexp" });
    const rb_identifier = new Attribute("RUBY_IDENTIFIER", text, { scope: "variable" });
    const rb_method_name = new Attribute("RUBY_METHOD_NAME", rb_identifier, { scope: "entity.name.function" });
    const rb_constant = new Attribute("RUBY_CONSTANT", rb_identifier, { scope: "constant" });
    const rb_constant_decl = new Attribute("RUBY_CONSTANT_DECLARATION", rb_identifier, { scope: "entity.name.type.class.ruby" });
    const rb_gvar = new Attribute("RUBY_GVAR", rb_identifier, { scope: "variable.other.readwrite.global" });
    const rb_cvar = new Attribute("RUBY_CVAR", rb_identifier, { scope: "variable.other.readwrite.class" });
    const rb_ivar = new Attribute("RUBY_IVAR", rb_identifier, { scope: "variable.other.readwrite.instance" });
    const rb_nth_ref = new Attribute("RUBY_NTH_REF", text);
    const rb_comma = new Attribute("RUBY_COMMA", default_comma, { scope: "punctuation.separator.object" });
    const rb_dot = new Attribute("RUBY_DOT", default_dot, { scope: "punctuation.separator.method" });
    const rb_colon = new Attribute("RUBY_COLON", default_semicolon);
    const rb_semicolon = new Attribute("RUBY_SEMICOLON", default_semicolon, { scope: "punctuation.separator.statement" });
    const rb_hash_assoc = new Attribute("RUBY_HASH_ASSOC", default_operation_sign, { scope: "punctuation.separator.key-value" });
    const rb_line_continuation = new Attribute("RUBY_LINE_CONTINUATION", default_operation_sign);
    const rb_local_var = new Attribute("RUBY_LOCAL_VAR_ID", rb_identifier);
    const rb_parameter = new Attribute("RUBY_PARAMETER_ID", rb_identifier, { scope: "variable.parameter" });
    const rb_symbol = new Attribute("RUBY_SYMBOL", rb_identifier, { scope: "constant.other.symbol" });
    const rb_specific_call = new Attribute("RUBY_SPECIFIC_CALL", rb_identifier, { scope: "storage" });
    const rb_paramdef = new Attribute("RUBY_PARAMDEF_CALL", rb_identifier, { scope: "support.function" });

    // Go
    const go_block_comment = new Attribute("GO_BLOCK_COMMENT", default_block_comment);
    const go_line_comment = new Attribute("GO_LINE_COMMENT", default_line_comment);
    const go_builtin_constant = new Attribute("GO_BUILTIN_CONSTANT", default_constant);
    const go_local_constant = new Attribute("GO_LOCAL_CONSTANT", default_constant);
    const go_package_local_constant = new Attribute("GO_PACKAGE_LOCAL_CONSTANT", default_constant);
    const go_package_exported_constant = new Attribute("GO_PACKAGE_EXPORTED_CONSTANT", default_constant);
    const go_builtin_variable = new Attribute("GO_BUILTIN_VARIABLE", default_global_variable);
    const go_method_receiver = new Attribute("GO_METHOD_RECEIVER", default_local_variable);
    const go_exported_function = new Attribute("GO_EXPORTED_FUNCTION", default_function_declaration);
    const go_local_function = new Attribute("GO_LOCAL_FUNCTION", default_function_declaration);
    const go_builtin_function_call = new Attribute("GO_BUILTIN_FUNCTION_CALL", default_function_call);
    const go_local_function_call = new Attribute("GO_LOCAL_FUNCTION_CALL", default_function_call);
    const go_exported_function_call = new Attribute("GO_EXPORTED_FUNCTION_CALL", default_function_call);
    const go_keyword = new Attribute("GO_KEYWORD", default_keyword);
    const go_package = new Attribute("GO_PACKAGE", default_identifier);
    const go_builtin_type_reference = new Attribute("GO_BUILTIN_TYPE_REFERENCE", default_class_name);
    const go_type_reference = new Attribute("GO_TYPE_REFERENCE", default_class_name);
}

async function main() {
    const response = await axios.get(DEFAULT_COLOR_SCHEMES_MANAGER_URL);
    const xml = response.data;

    const schemes = parseXmlScheme(xml);
    const darcula = getScheme("Darcula", schemes);

    console.log(JSON.stringify(darcula, null, 2));
}

main();
