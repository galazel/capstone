from langchain_core.tools import tool
from app.utils.helpers import create_id
from app.tools.certification.web_search import (
    format_organic_results,
    serper_image_search,
    serper_search,
    youtube_search,
)

@tool("add_lesson_heading",
      description="Creates a primary section heading (H1/H2 level) to introduce a major topic block inside the lesson.")
def create_heading(text: str):
    return {
        "type": "heading",
        "data": {"text": text}
    }


@tool("add_lesson_subheading",
      description="Creates a secondary supporting subheading (H3 level) to break down major sections into smaller subsections.")
def create_subheading(text: str):
    return {
        "type": "subheading",
        "data": {"text": text}
    }


@tool("add_lesson_paragraph",
      description="Creates regular body text or paragraphs to explain core concepts, context, or instructions.")
def create_description(text: str):
    return {
        "type": "description",
        "data": {"text": text}
    }


@tool("add_bullet_list",
      description="Creates an unordered bulleted list for listing features, key terms, or items without a specific sequence.")
def create_unordered_list(items: list[str]):
    return {
        "type": "unordered-list",
        "data": {
            "items": [{"id": create_id(), "text": item} for item in items]
        }
    }


@tool("add_numbered_list",
      description="Creates a sequential, numbered list for step-by-step procedures, workflows, or ordered rankings.")
def create_ordered_list(items: list[str]):
    return {
        "type": "ordered-list",
        "data": {
            "items": [{"id": create_id(), "text": item} for item in items]
        }
    }


@tool("add_image_left_layout",
      description="Displays an educational diagram or chart on the left side and descriptive text content on the right side.")
def create_image_left_text(title: str, description: str, image_key: str = ""):
    return {
        "type": "image-left-text",
        "data": {
            "file": None,
            "imageKey": image_key,
            "title": title,
            "description": description
        }
    }


@tool("add_image_right_layout",
      description="Displays descriptive text content on the left side and an educational diagram or chart on the right side.")
def create_image_right_text(title: str, description: str, image_key: str = ""):
    return {
        "type": "image-right-text",
        "data": {
            "file": None,
            "imageKey": image_key,
            "title": title,
            "description": description
        }
    }


@tool("add_tabbed_content",
      description="Creates interactive tabbed sections for switching between multiple categories or views. Each item requires keys: label, title, description.")
def create_tabs(items: list[dict]):
    return {
        "type": "tabs",
        "data": {
            "items": [{"id": create_id(), **item} for item in items]
        }
    }


@tool("add_accordion_section",
      description="Creates expandable/collapsible vertical accordion blocks for toggling details of complex subtopics. Each item requires keys: title, description.")
def create_accordion(items: list[dict]):
    return {
        "type": "accordion",
        "data": {
            "items": [{"id": create_id(), **item} for item in items]
        }
    }


@tool("add_interactive_flip_cards",
      description="Creates a grid of interactive flip cards for active recall and memorization. Each card requires keys: frontTitle, backTitle, description.")
def create_flip_cards(cards: list[dict]):
    return {
        "type": "flip-grid",
        "data": {
            "cards": [{"id": create_id(), **card} for card in cards]
        }
    }


@tool("add_standalone_image",
      description="Embeds a standalone educational chart, diagram, or graphic into the lesson using an image URL.")
def create_image(image_key: str):
    return {
        "type": "image",
        "data": {
            "file": None,
            "imageKey": image_key
        }
    }


@tool("add_standalone_video",
      description="Embeds a standalone video player into the lesson flow using a YouTube video URL.")
def create_video(video_key: str):
    return {
        "type": "video",
        "data": {
            "file": None,
            "videoKey": video_key
        }
    }


@tool("add_intro_image_card",
      description="Creates an introductory header block containing a small category header, description text, and a technical or conceptual graphic.")
def create_intro_image_card(small_header: str, description: str, image_key: str = ""):
    return {
        "type": "intro-image-card",
        "data": {
            "smallHeader": small_header,
            "description": description,
            "file": None,
            "imageKey": image_key
        }
    }


@tool("add_header_with_grid_cards",
      description="Creates a top section header and description followed by a grid of structured feature/card items.")
def create_header_description_grid(small_header: str, description: str, grid_items: list[dict]):
    return {
        "type": "header-description-grid",
        "data": {
            "smallHeader": small_header,
            "description": description,
            "gridItems": [{"id": create_id(), **item} for item in grid_items]
        }
    }


@tool("add_image_with_feature_grid",
      description="Creates a layout pairing a technical diagram or architecture graphic alongside a structured grid of feature cards.")
def create_image_feature_grid(small_header: str, description: str, image_key: str, grid_items: list[dict]):
    return {
        "type": "image-feature-grid",
        "data": {
            "smallHeader": small_header,
            "description": description,
            "file": None,
            "imageKey": image_key,
            "gridItems": [{"id": create_id(), **item} for item in grid_items]
        }
    }


@tool("add_review_card_grid",
      description="Creates practice and exam-review cards to reinforce critical learning concepts.")
def create_review_card_grid(cards: list[dict]):
    return {
        "type": "review-card-grid",
        "data": {
            "cards": [{"id": create_id(), **card} for card in cards]
        }
    }


@tool("add_content_accordion_block",
      description="Creates an introductory section header and description followed by expandable accordion items.")
def create_content_accordion_block(small_header: str, description: str, items: list[dict]):
    return {
        "type": "content-accordion-block",
        "data": {
            "smallHeader": small_header,
            "description": description,
            "items": [{"id": create_id(), **item} for item in items]
        }
    }


@tool("add_media_text_block",
      description="Creates a flexible block combining a main header/description with supporting text and either an educational diagram image or a YouTube video asset.")
def create_media_text_block(
        small_header: str,
        description: str,
        media_type: str,
        supporting_title: str,
        supporting_description: str,
        layout: str = "image-left",
        image_key: str = "",
        video_key: str = ""
):
    return {
        "type": "media-text-block",
        "data": {
            "smallHeader": small_header,
            "description": description,
            "mediaType": media_type,
            "file": None,
            "imageKey": image_key,
            "videoKey": video_key,
            "supportingTitle": supporting_title,
            "supportingDescription": supporting_description,
            "layout": layout
        }
    }


@tool("search_educational_image",
      description="Searches the web via Google Custom Search / Serper for educational diagrams, technical charts, or architecture schematics matching the query and returns the direct image URL.")
def search_educational_image(query: str) -> str:
    try:
        images = serper_image_search(query + " diagram architecture chart", num=1)
    except RuntimeError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Search failed ({e})"

    if images:
        return images[0].get("imageUrl", "No image URL found.")
    return "No educational diagram found."


@tool("search_youtube_videos",
      description="Searches YouTube for a relevant tutorial or educational video matching a query and returns the watch URL to use as a videoKey.")
def search_youtube_videos(query: str) -> str:
    try:
        items = youtube_search(query, max_results=1)
    except RuntimeError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Search failed ({e})"

    if items:
        video_id = items[0]["id"]["videoId"]
        return f"https://www.youtube.com/watch?v={video_id}"
    return "No matching videos found."


@tool("search_more_lesson_info", description="Search more reliable and accurate info if the uploaded content or the data stored in vector database is not enough.")
def search_more_lesson_info(query: str) -> str:
    try:
        results = serper_search(query, num=5)
    except RuntimeError as e:
        return f"Error: {e}"
    except Exception as e:
        return f"Search failed ({e})"

    return format_organic_results(results) or "No additional reliable lesson information found."


lesson_builder_tools = [
    create_heading,
    create_subheading,
    create_description,
    create_unordered_list,
    create_ordered_list,
    create_image_left_text,
    create_image_right_text,
    create_tabs,
    create_accordion,
    create_flip_cards,
    create_image,
    create_video,
    create_intro_image_card,
    create_header_description_grid,
    create_image_feature_grid,
    create_review_card_grid,
    create_content_accordion_block,
    create_media_text_block,
]

lesson_search_tools = [
    search_educational_image,
    search_youtube_videos,
    search_more_lesson_info,
]

