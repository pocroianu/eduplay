/**
 * Prompt Templates Library
 *
 * 50+ prompt templates for generating educational content
 */

import { PromptTemplate } from './types';

/**
 * Image prompt templates for educational content
 * Total: 25+ templates across categories
 */
export const IMAGE_PROMPTS: PromptTemplate[] = [
  // ========== FRUITS CATEGORY (5 templates) ==========
  {
    id: 'fruit-cartoon-simple',
    category: 'fruits',
    type: 'image',
    template: 'A friendly cartoon {{fruit}}, bright vibrant colors, simple shapes, clean white background, children\'s book illustration style, cute and appealing, professional quality',
    variables: [
      {
        name: 'fruit',
        type: 'enum',
        description: 'Type of fruit to generate',
        required: true,
        options: ['apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon', 'pear', 'cherry', 'lemon', 'pineapple']
      }
    ],
    style: 'cartoon-friendly',
    negativePrompt: 'scary, dark, realistic, photo, complex details, shadows, text, watermark, adult, violent',
    examples: [
      'A friendly cartoon apple, bright vibrant colors, simple shapes...',
      'A friendly cartoon banana, bright vibrant colors, simple shapes...'
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'fruit-cartoon-with-face',
    category: 'fruits',
    type: 'image',
    template: 'A cute cartoon {{fruit}} with a smiling face and big friendly eyes, kawaii style, bright happy colors, simple rounded shapes, clean white background, children\'s educational content, cheerful and inviting',
    variables: [
      {
        name: 'fruit',
        type: 'enum',
        description: 'Type of fruit',
        required: true,
        options: ['apple', 'banana', 'orange', 'grape', 'strawberry', 'watermelon', 'pear', 'cherry']
      }
    ],
    style: 'cartoon-kawaii',
    negativePrompt: 'scary, creepy, realistic, photo, complex, dark, shadows, text, watermark',
    metadata: {
      targetAge: '3-6',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'fruit-slice-simple',
    category: 'fruits',
    type: 'image',
    template: 'A cartoon slice of {{fruit}}, showing the inside, bright colors, simple illustration, clean white background, educational diagram style',
    variables: [
      {
        name: 'fruit',
        type: 'enum',
        description: 'Type of fruit to slice',
        required: true,
        options: ['apple', 'orange', 'watermelon', 'kiwi', 'lemon', 'lime']
      }
    ],
    style: 'cartoon-educational',
    negativePrompt: 'realistic, photo, complex, dark, messy, unclear',
    metadata: {
      targetAge: '4-8',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'fruit-multiple-count',
    category: 'fruits',
    type: 'image',
    template: '{{count}} cartoon {{fruit}}s arranged neatly in a row, bright colors, simple shapes, clean white background, counting illustration for children',
    variables: [
      {
        name: 'count',
        type: 'enum',
        description: 'Number of fruits',
        required: true,
        options: ['2', '3', '4', '5']
      },
      {
        name: 'fruit',
        type: 'enum',
        description: 'Type of fruit',
        required: true,
        options: ['apple', 'banana', 'orange', 'strawberry']
      }
    ],
    style: 'cartoon-educational',
    negativePrompt: 'messy, overlapping, cluttered, complex, realistic',
    metadata: {
      targetAge: '3-7',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'fruit-basket',
    category: 'fruits',
    type: 'image',
    template: 'A cartoon basket filled with colorful fruits including {{fruits}}, bright cheerful colors, simple illustration, clean white background, children\'s book style',
    variables: [
      {
        name: 'fruits',
        type: 'string',
        description: 'Comma-separated list of fruits',
        required: true,
        default: 'apples, bananas, oranges'
      }
    ],
    style: 'cartoon-scene',
    negativePrompt: 'realistic, dark, complex, messy, unclear',
    metadata: {
      targetAge: '4-8',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  // ========== ANIMALS CATEGORY (5 templates) ==========
  {
    id: 'animal-cartoon-simple',
    category: 'animals',
    type: 'image',
    template: 'A cute cartoon {{animal}}, friendly and non-threatening, bright cheerful colors, simple rounded shapes, clean white background, children\'s book illustration, educational quality',
    variables: [
      {
        name: 'animal',
        type: 'enum',
        description: 'Type of animal',
        required: true,
        options: ['dog', 'cat', 'rabbit', 'bird', 'fish', 'elephant', 'lion', 'monkey', 'bear', 'giraffe', 'zebra', 'cow']
      }
    ],
    style: 'cartoon-friendly',
    negativePrompt: 'scary, aggressive, realistic, photo, complex, dark, violent, teeth, claws',
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'animal-baby',
    category: 'animals',
    type: 'image',
    template: 'A cute baby {{animal}}, adorable and friendly, big eyes, cartoon style, soft pastel colors, simple shapes, clean white background, kawaii aesthetic',
    variables: [
      {
        name: 'animal',
        type: 'enum',
        description: 'Type of animal',
        required: true,
        options: ['dog', 'cat', 'elephant', 'lion', 'bear', 'rabbit', 'duck', 'penguin']
      }
    ],
    style: 'cartoon-kawaii',
    negativePrompt: 'scary, dark, realistic, aggressive, complex',
    metadata: {
      targetAge: '3-6',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'animal-farm',
    category: 'animals',
    type: 'image',
    template: 'A friendly cartoon farm {{animal}}, simple illustration, bright colors, clean white background, children\'s educational content',
    variables: [
      {
        name: 'animal',
        type: 'enum',
        description: 'Farm animal type',
        required: true,
        options: ['cow', 'pig', 'chicken', 'horse', 'sheep', 'duck', 'goat']
      }
    ],
    style: 'cartoon-educational',
    negativePrompt: 'scary, realistic, dark, complex, farm background',
    metadata: {
      targetAge: '3-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'animal-wild',
    category: 'animals',
    type: 'image',
    template: 'A friendly cartoon wild {{animal}}, non-threatening appearance, bright colors, simple shapes, clean white background, educational wildlife illustration',
    variables: [
      {
        name: 'animal',
        type: 'enum',
        description: 'Wild animal type',
        required: true,
        options: ['lion', 'elephant', 'giraffe', 'zebra', 'monkey', 'tiger', 'panda', 'koala']
      }
    ],
    style: 'cartoon-educational',
    negativePrompt: 'scary, aggressive, realistic, dangerous, dark',
    metadata: {
      targetAge: '4-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'animal-pet',
    category: 'animals',
    type: 'image',
    template: 'A cute cartoon pet {{animal}} with collar, happy and playful, bright colors, simple illustration, clean white background, child-friendly',
    variables: [
      {
        name: 'animal',
        type: 'enum',
        description: 'Pet type',
        required: true,
        options: ['dog', 'cat', 'hamster', 'rabbit', 'fish', 'bird']
      }
    ],
    style: 'cartoon-friendly',
    negativePrompt: 'scary, realistic, dark, complex, aggressive',
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  // ========== COLORS CATEGORY (5 templates) ==========
  {
    id: 'color-object-simple',
    category: 'colors',
    type: 'image',
    template: 'A simple {{color}} {{object}}, solid bright color, minimal details, clean white background, flat illustration style, educational content for learning colors',
    variables: [
      {
        name: 'color',
        type: 'enum',
        description: 'Color to display',
        required: true,
        options: ['red', 'blue', 'yellow', 'green', 'orange', 'purple', 'pink', 'brown', 'black', 'white']
      },
      {
        name: 'object',
        type: 'enum',
        description: 'Object to color',
        required: true,
        options: ['ball', 'square', 'circle', 'star', 'heart', 'triangle', 'flower', 'balloon', 'car', 'house']
      }
    ],
    style: 'flat-simple',
    negativePrompt: 'complex, realistic, gradient, shadow, texture, pattern',
    metadata: {
      targetAge: '3-5',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'color-swatch',
    category: 'colors',
    type: 'image',
    template: 'A {{color}} color swatch, solid color fill, simple square or circle, clean white background, color learning card',
    variables: [
      {
        name: 'color',
        type: 'enum',
        description: 'Color name',
        required: true,
        options: ['red', 'blue', 'yellow', 'green', 'orange', 'purple', 'pink', 'brown', 'black', 'white', 'gray']
      }
    ],
    style: 'flat-minimal',
    negativePrompt: 'complex, gradient, pattern, texture, realistic',
    metadata: {
      targetAge: '3-5',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'color-mixing',
    category: 'colors',
    type: 'image',
    template: '{{color1}} and {{color2}} mixing to make {{resultColor}}, simple illustration, paint drops or circles, clean white background, color theory for kids',
    variables: [
      {
        name: 'color1',
        type: 'enum',
        description: 'First color',
        required: true,
        options: ['red', 'blue', 'yellow']
      },
      {
        name: 'color2',
        type: 'enum',
        description: 'Second color',
        required: true,
        options: ['red', 'blue', 'yellow']
      },
      {
        name: 'resultColor',
        type: 'enum',
        description: 'Result color',
        required: true,
        options: ['orange', 'green', 'purple']
      }
    ],
    style: 'educational-diagram',
    negativePrompt: 'complex, realistic, messy, unclear',
    metadata: {
      targetAge: '5-8',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'color-rainbow',
    category: 'colors',
    type: 'image',
    template: 'A simple cartoon rainbow with {{numColors}} colors, bright and cheerful, clean white background, children\'s illustration',
    variables: [
      {
        name: 'numColors',
        type: 'enum',
        description: 'Number of rainbow colors',
        required: true,
        options: ['3', '5', '7'],
        default: '7'
      }
    ],
    style: 'cartoon-simple',
    negativePrompt: 'complex, realistic, dark, messy, clouds, landscape',
    metadata: {
      targetAge: '3-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'color-collection',
    category: 'colors',
    type: 'image',
    template: 'A collection of {{color}} objects including {{objects}}, all in shades of {{color}}, simple illustrations, clean white background',
    variables: [
      {
        name: 'color',
        type: 'enum',
        description: 'Theme color',
        required: true,
        options: ['red', 'blue', 'yellow', 'green']
      },
      {
        name: 'objects',
        type: 'string',
        description: 'Objects in that color',
        required: true,
        default: 'apple, flower, balloon'
      }
    ],
    style: 'educational-collection',
    negativePrompt: 'messy, complex, realistic, cluttered',
    metadata: {
      targetAge: '4-7',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  // ========== SHAPES CATEGORY (4 templates) ==========
  {
    id: 'shape-basic-colored',
    category: 'shapes',
    type: 'image',
    template: 'A {{color}} {{shape}}, geometric and precise, solid color fill, clean white background, educational geometry illustration, simple and clear',
    variables: [
      {
        name: 'shape',
        type: 'enum',
        description: 'Shape type',
        required: true,
        options: ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart', 'oval', 'diamond', 'hexagon', 'pentagon']
      },
      {
        name: 'color',
        type: 'enum',
        description: 'Shape color',
        required: true,
        options: ['red', 'blue', 'yellow', 'green', 'orange', 'purple']
      }
    ],
    style: 'geometric-simple',
    negativePrompt: 'complex, 3D, shadow, gradient, texture, realistic',
    metadata: {
      targetAge: '3-6',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'shape-outline',
    category: 'shapes',
    type: 'image',
    template: 'A {{shape}} outline in {{color}}, thick stroke, no fill, clean white background, tracing practice for kids',
    variables: [
      {
        name: 'shape',
        type: 'enum',
        description: 'Shape type',
        required: true,
        options: ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart']
      },
      {
        name: 'color',
        type: 'enum',
        description: 'Outline color',
        required: true,
        options: ['black', 'red', 'blue', 'green']
      }
    ],
    style: 'outline-simple',
    negativePrompt: 'filled, complex, 3D, shadow, gradient',
    metadata: {
      targetAge: '3-6',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'shape-pattern',
    category: 'shapes',
    type: 'image',
    template: 'A simple pattern made of repeating {{shape}}s in {{color}}, organized grid layout, clean white background, pattern recognition for kids',
    variables: [
      {
        name: 'shape',
        type: 'enum',
        description: 'Shape to repeat',
        required: true,
        options: ['circle', 'square', 'triangle', 'star']
      },
      {
        name: 'color',
        type: 'enum',
        description: 'Pattern color',
        required: true,
        options: ['red', 'blue', 'yellow', 'green']
      }
    ],
    style: 'pattern-educational',
    negativePrompt: 'messy, complex, random, cluttered',
    metadata: {
      targetAge: '4-7',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'shape-3d-simple',
    category: 'shapes',
    type: 'image',
    template: 'A simple 3D {{shape}} in {{color}}, basic shading, clean white background, geometric solid for children',
    variables: [
      {
        name: 'shape',
        type: 'enum',
        description: '3D shape type',
        required: true,
        options: ['sphere', 'cube', 'cylinder', 'cone', 'pyramid']
      },
      {
        name: 'color',
        type: 'enum',
        description: 'Shape color',
        required: true,
        options: ['red', 'blue', 'yellow', 'green']
      }
    ],
    style: 'geometric-3d-simple',
    negativePrompt: 'complex, realistic, textured, dark, messy',
    metadata: {
      targetAge: '5-8',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  // ========== NUMBERS CATEGORY (3 templates) ==========
  {
    id: 'number-with-objects',
    category: 'numbers',
    type: 'image',
    template: '{{count}} cute cartoon {{object}}s arranged neatly, bright cheerful colors, simple shapes, clean white background, educational counting illustration, clear and organized',
    variables: [
      {
        name: 'count',
        type: 'enum',
        description: 'Number to show',
        required: true,
        options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
      },
      {
        name: 'object',
        type: 'enum',
        description: 'Object to count',
        required: true,
        options: ['apple', 'star', 'ball', 'flower', 'butterfly', 'fish', 'car', 'block', 'heart', 'balloon']
      }
    ],
    style: 'cartoon-educational',
    negativePrompt: 'messy, cluttered, overlapping, complex, realistic, dark',
    metadata: {
      targetAge: '3-7',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'number-digit',
    category: 'numbers',
    type: 'image',
    template: 'The number {{number}} in large {{color}} digits, bold and clear, clean white background, simple font, educational number card',
    variables: [
      {
        name: 'number',
        type: 'enum',
        description: 'Number to display',
        required: true,
        options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
      },
      {
        name: 'color',
        type: 'enum',
        description: 'Digit color',
        required: true,
        options: ['red', 'blue', 'green', 'orange', 'purple']
      }
    ],
    style: 'typographic-simple',
    negativePrompt: 'complex, decorative, small, unclear, patterned',
    metadata: {
      targetAge: '3-6',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'number-dots',
    category: 'numbers',
    type: 'image',
    template: '{{count}} {{color}} dots arranged in a dice-like pattern, simple circles, clean white background, number recognition aid',
    variables: [
      {
        name: 'count',
        type: 'enum',
        description: 'Number of dots',
        required: true,
        options: ['1', '2', '3', '4', '5', '6']
      },
      {
        name: 'color',
        type: 'enum',
        description: 'Dot color',
        required: true,
        options: ['black', 'red', 'blue', 'green']
      }
    ],
    style: 'minimal-educational',
    negativePrompt: 'messy, complex, realistic, random',
    metadata: {
      targetAge: '3-5',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  // ========== LETTERS CATEGORY (3 templates) ==========
  {
    id: 'letter-uppercase',
    category: 'letters',
    type: 'image',
    template: 'The uppercase letter {{letter}} in {{color}}, large and bold, simple sans-serif font, clean white background, alphabet learning card',
    variables: [
      {
        name: 'letter',
        type: 'string',
        description: 'Letter to display (A-Z)',
        required: true,
        validation: {
          pattern: '^[A-Z]$'
        }
      },
      {
        name: 'color',
        type: 'enum',
        description: 'Letter color',
        required: true,
        options: ['red', 'blue', 'green', 'orange', 'purple']
      }
    ],
    style: 'typographic-educational',
    negativePrompt: 'complex, decorative, small, cursive, unclear',
    metadata: {
      targetAge: '3-6',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'letter-lowercase',
    category: 'letters',
    type: 'image',
    template: 'The lowercase letter {{letter}} in {{color}}, large and clear, simple sans-serif font, clean white background, alphabet learning card',
    variables: [
      {
        name: 'letter',
        type: 'string',
        description: 'Letter to display (a-z)',
        required: true,
        validation: {
          pattern: '^[a-z]$'
        }
      },
      {
        name: 'color',
        type: 'enum',
        description: 'Letter color',
        required: true,
        options: ['red', 'blue', 'green', 'orange', 'purple']
      }
    ],
    style: 'typographic-educational',
    negativePrompt: 'complex, decorative, small, cursive, unclear',
    metadata: {
      targetAge: '4-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'letter-with-object',
    category: 'letters',
    type: 'image',
    template: 'The letter {{letter}} with a cute cartoon {{object}} that starts with that letter, colorful illustration, clean white background, phonics learning',
    variables: [
      {
        name: 'letter',
        type: 'string',
        description: 'Letter to display',
        required: true,
        validation: {
          pattern: '^[A-Za-z]$'
        }
      },
      {
        name: 'object',
        type: 'string',
        description: 'Object starting with the letter',
        required: true
      }
    ],
    style: 'educational-phonics',
    negativePrompt: 'complex, realistic, dark, messy, unclear',
    metadata: {
      targetAge: '4-7',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  }
];

/**
 * Text prompt templates for questions and content
 * Total: 20+ templates
 */
export const TEXT_PROMPTS: PromptTemplate[] = [
  // ========== QUESTIONS (10 templates) ==========
  {
    id: 'question-identification-simple',
    category: 'questions',
    type: 'text',
    template: 'Generate a simple question for children aged {{targetAge}} to identify a {{category}}. Use the format: "Which one is [the/a] {{item}}?" Keep it under 10 words.',
    variables: [
      {
        name: 'targetAge',
        type: 'string',
        description: 'Target age range',
        required: true,
        default: '3-8'
      },
      {
        name: 'category',
        type: 'enum',
        description: 'Content category',
        required: true,
        options: ['fruit', 'animal', 'color', 'shape', 'number', 'object', 'letter']
      },
      {
        name: 'item',
        type: 'string',
        description: 'Specific item to ask about',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-counting',
    category: 'questions',
    type: 'text',
    template: 'Generate a counting question for ages {{targetAge}} about {{object}}s. Example: "How many {{object}}s are there?" Keep simple and encouraging.',
    variables: [
      {
        name: 'targetAge',
        type: 'string',
        description: 'Target age',
        required: true,
        default: '3-7'
      },
      {
        name: 'object',
        type: 'string',
        description: 'Object to count',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-color-identification',
    category: 'questions',
    type: 'text',
    template: 'Create a color identification question for young children about {{color}}. Format: "Which one is {{color}}?" Very simple language.',
    variables: [
      {
        name: 'color',
        type: 'enum',
        description: 'Color to identify',
        required: true,
        options: ['red', 'blue', 'yellow', 'green', 'orange', 'purple', 'pink']
      }
    ],
    metadata: {
      targetAge: '3-5',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-shape-identification',
    category: 'questions',
    type: 'text',
    template: 'Write a shape recognition question for children aged {{targetAge}}. Ask them to find a {{shape}}. Use simple, friendly language.',
    variables: [
      {
        name: 'targetAge',
        type: 'string',
        description: 'Age range',
        required: true,
        default: '3-6'
      },
      {
        name: 'shape',
        type: 'enum',
        description: 'Shape to find',
        required: true,
        options: ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart']
      }
    ],
    metadata: {
      targetAge: '3-6',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-comparison',
    category: 'questions',
    type: 'text',
    template: 'Create a comparison question for ages {{targetAge}}. Compare {{item1}} and {{item2}} by {{property}}. Example: "Which one is bigger?" Keep very simple.',
    variables: [
      {
        name: 'targetAge',
        type: 'string',
        description: 'Target age',
        required: true,
        default: '4-8'
      },
      {
        name: 'item1',
        type: 'string',
        description: 'First item',
        required: true
      },
      {
        name: 'item2',
        type: 'string',
        description: 'Second item',
        required: true
      },
      {
        name: 'property',
        type: 'enum',
        description: 'Property to compare',
        required: true,
        options: ['size', 'color', 'shape', 'count']
      }
    ],
    metadata: {
      targetAge: '4-8',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-matching',
    category: 'questions',
    type: 'text',
    template: 'Generate a matching question for young learners. Ask them to find what goes with {{item}}. Use encouraging, simple language.',
    variables: [
      {
        name: 'item',
        type: 'string',
        description: 'Item to match',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-category',
    category: 'questions',
    type: 'text',
    template: 'Write a categorization question for ages {{targetAge}}. Ask which item belongs to {{category}}. Simple and clear wording.',
    variables: [
      {
        name: 'targetAge',
        type: 'string',
        description: 'Target age',
        required: true,
        default: '4-8'
      },
      {
        name: 'category',
        type: 'string',
        description: 'Category name',
        required: true
      }
    ],
    metadata: {
      targetAge: '4-8',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-sequence',
    category: 'questions',
    type: 'text',
    template: 'Create a sequencing question for children. Ask about what comes {{position}} in a sequence. Use simple words appropriate for ages {{targetAge}}.',
    variables: [
      {
        name: 'position',
        type: 'enum',
        description: 'Position in sequence',
        required: true,
        options: ['first', 'next', 'last']
      },
      {
        name: 'targetAge',
        type: 'string',
        description: 'Age range',
        required: true,
        default: '4-8'
      }
    ],
    metadata: {
      targetAge: '4-8',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-letter-sound',
    category: 'questions',
    type: 'text',
    template: 'Write a phonics question for early readers about the letter {{letter}}. Ask what sound it makes or what starts with it. Age-appropriate for {{targetAge}}.',
    variables: [
      {
        name: 'letter',
        type: 'string',
        description: 'Letter to ask about',
        required: true,
        validation: {
          pattern: '^[A-Za-z]$'
        }
      },
      {
        name: 'targetAge',
        type: 'string',
        description: 'Age range',
        required: true,
        default: '4-7'
      }
    ],
    metadata: {
      targetAge: '4-7',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'question-rhyming',
    category: 'questions',
    type: 'text',
    template: 'Create a rhyming question for young children. Ask which word rhymes with {{word}}. Use playful, simple language.',
    variables: [
      {
        name: 'word',
        type: 'string',
        description: 'Word to find rhyme for',
        required: true
      }
    ],
    metadata: {
      targetAge: '4-7',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  // ========== FEEDBACK (6 templates) ==========
  {
    id: 'feedback-correct-enthusiastic',
    category: 'feedback',
    type: 'text',
    template: 'Generate an enthusiastic positive feedback message for a child who answered correctly about {{topic}}. Use simple words, be very encouraging. Include celebration words like "Great!", "Awesome!", "Perfect!". Max 8 words.',
    variables: [
      {
        name: 'topic',
        type: 'string',
        description: 'Topic of the question',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'feedback-correct-specific',
    category: 'feedback',
    type: 'text',
    template: 'Write specific positive feedback acknowledging the child found the correct {{item}}. Be warm and encouraging. 6-10 words.',
    variables: [
      {
        name: 'item',
        type: 'string',
        description: 'Correct item they identified',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'feedback-incorrect-gentle',
    category: 'feedback',
    type: 'text',
    template: 'Generate gentle, encouraging feedback for an incorrect answer. Be supportive, suggest trying again. Use phrases like "Not quite", "Try again", "You can do it!". Max 8 words.',
    variables: [],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'feedback-incorrect-hint',
    category: 'feedback',
    type: 'text',
    template: 'Write encouraging feedback with a gentle hint about {{correctAnswer}}. Be positive and supportive. Don\'t give away the answer directly. 8-12 words.',
    variables: [
      {
        name: 'correctAnswer',
        type: 'string',
        description: 'The correct answer to hint at',
        required: true
      }
    ],
    metadata: {
      targetAge: '4-8',
      complexity: 'moderate',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'feedback-completion',
    category: 'feedback',
    type: 'text',
    template: 'Create a celebration message for completing all questions. Be enthusiastic and proud. Mention they did a great job. 8-12 words.',
    variables: [],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'feedback-encouragement',
    category: 'feedback',
    type: 'text',
    template: 'Write a motivational message to encourage the child to keep going. Be positive and uplifting. 6-10 words.',
    variables: [],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  // ========== INSTRUCTIONS (4 templates) ==========
  {
    id: 'instruction-tap-select',
    category: 'instructions',
    type: 'text',
    template: 'Write simple instructions for children to tap or select {{item}}. Use clear, direct language. 5-8 words.',
    variables: [
      {
        name: 'item',
        type: 'string',
        description: 'What to select',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'instruction-drag-drop',
    category: 'instructions',
    type: 'text',
    template: 'Create drag-and-drop instructions for young children. Tell them to drag {{item}} to {{destination}}. Very simple words. 6-10 words.',
    variables: [
      {
        name: 'item',
        type: 'string',
        description: 'Item to drag',
        required: true
      },
      {
        name: 'destination',
        type: 'string',
        description: 'Where to drag it',
        required: true
      }
    ],
    metadata: {
      targetAge: '4-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'instruction-match',
    category: 'instructions',
    type: 'text',
    template: 'Write matching game instructions for children. Tell them to match {{type1}} with {{type2}}. Clear and simple. 6-10 words.',
    variables: [
      {
        name: 'type1',
        type: 'string',
        description: 'First type to match',
        required: true
      },
      {
        name: 'type2',
        type: 'string',
        description: 'Second type to match',
        required: true
      }
    ],
    metadata: {
      targetAge: '4-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'instruction-count',
    category: 'instructions',
    type: 'text',
    template: 'Create counting instructions for young learners. Ask them to count the {{objects}} and select the right number. Simple language. 8-12 words.',
    variables: [
      {
        name: 'objects',
        type: 'string',
        description: 'Objects to count',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  }
];

/**
 * Audio prompt templates (TTS configurations)
 * Total: 10+ templates
 */
export const AUDIO_PROMPTS: PromptTemplate[] = [
  {
    id: 'narration-question-en',
    category: 'narration',
    type: 'audio',
    template: '{{text}}',
    variables: [
      {
        name: 'text',
        type: 'string',
        description: 'Question text to narrate in English',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-question-ro',
    category: 'narration',
    type: 'audio',
    template: '{{text}}',
    variables: [
      {
        name: 'text',
        type: 'string',
        description: 'Question text to narrate in Romanian',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-feedback-en',
    category: 'narration',
    type: 'audio',
    template: '{{text}}',
    variables: [
      {
        name: 'text',
        type: 'string',
        description: 'Feedback text to narrate in English',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-feedback-ro',
    category: 'narration',
    type: 'audio',
    template: '{{text}}',
    variables: [
      {
        name: 'text',
        type: 'string',
        description: 'Feedback text to narrate in Romanian',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-instruction-en',
    category: 'narration',
    type: 'audio',
    template: '{{text}}',
    variables: [
      {
        name: 'text',
        type: 'string',
        description: 'Instruction text to narrate in English',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-instruction-ro',
    category: 'narration',
    type: 'audio',
    template: '{{text}}',
    variables: [
      {
        name: 'text',
        type: 'string',
        description: 'Instruction text to narrate in Romanian',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-counting-en',
    category: 'narration',
    type: 'audio',
    template: '{{number}}',
    variables: [
      {
        name: 'number',
        type: 'string',
        description: 'Number to pronounce in English',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-counting-ro',
    category: 'narration',
    type: 'audio',
    template: '{{number}}',
    variables: [
      {
        name: 'number',
        type: 'string',
        description: 'Number to pronounce in Romanian',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-letter-en',
    category: 'narration',
    type: 'audio',
    template: '{{letter}}',
    variables: [
      {
        name: 'letter',
        type: 'string',
        description: 'Letter to pronounce in English',
        required: true,
        validation: {
          pattern: '^[A-Za-z]$'
        }
      }
    ],
    metadata: {
      targetAge: '4-7',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  },

  {
    id: 'narration-word-en',
    category: 'narration',
    type: 'audio',
    template: '{{word}}',
    variables: [
      {
        name: 'word',
        type: 'string',
        description: 'Word to pronounce clearly in English',
        required: true
      }
    ],
    metadata: {
      targetAge: '3-8',
      complexity: 'simple',
      version: '1.0',
      author: 'AI Content Team'
    }
  }
];

/**
 * Negative prompts for image generation
 */
export const NEGATIVE_PROMPTS = {
  default: 'scary, dark, violent, realistic, photo, complex details, shadows, adult content, text, watermark, nsfw, gore, blood',

  childSafe: 'scary, creepy, dark, violent, aggressive, teeth showing, claws, monsters, horror, frightening, threatening, angry, sad, crying',

  simple: 'complex, detailed, intricate, ornate, busy, cluttered, messy, chaotic, gradient, texture, shadow, 3D, realistic',

  clean: 'text, watermark, signature, logo, border, frame, background objects, distracting elements'
};

/**
 * Get prompts by category and type
 */
export function getPromptsByCategory(
  category: string,
  type: 'image' | 'text' | 'audio'
): PromptTemplate[] {
  const allPrompts = {
    image: IMAGE_PROMPTS,
    text: TEXT_PROMPTS,
    audio: AUDIO_PROMPTS
  };

  return allPrompts[type].filter(p => p.category === category);
}

/**
 * Get prompt by ID
 */
export function getPromptById(id: string): PromptTemplate | undefined {
  const allPrompts = [...IMAGE_PROMPTS, ...TEXT_PROMPTS, ...AUDIO_PROMPTS];
  return allPrompts.find(p => p.id === id);
}

/**
 * Get all image prompts
 */
export function getAllImagePrompts(): PromptTemplate[] {
  return IMAGE_PROMPTS;
}

/**
 * Get all text prompts
 */
export function getAllTextPrompts(): PromptTemplate[] {
  return TEXT_PROMPTS;
}

/**
 * Get all audio prompts
 */
export function getAllAudioPrompts(): PromptTemplate[] {
  return AUDIO_PROMPTS;
}

/**
 * Get all negative prompts combined
 */
export function getAllNegativePrompts(): string {
  return Object.values(NEGATIVE_PROMPTS).join(', ');
}

/**
 * Get negative prompt by type
 */
export function getNegativePrompt(type: keyof typeof NEGATIVE_PROMPTS): string {
  return NEGATIVE_PROMPTS[type];
}

/**
 * Get template count summary
 */
export function getTemplateSummary(): {
  total: number;
  byType: Record<string, number>;
  byCategory: Record<string, number>;
} {
  const allPrompts = [...IMAGE_PROMPTS, ...TEXT_PROMPTS, ...AUDIO_PROMPTS];

  const byType: Record<string, number> = {};
  const byCategory: Record<string, number> = {};

  for (const prompt of allPrompts) {
    byType[prompt.type] = (byType[prompt.type] || 0) + 1;
    byCategory[prompt.category] = (byCategory[prompt.category] || 0) + 1;
  }

  return {
    total: allPrompts.length,
    byType,
    byCategory
  };
}
