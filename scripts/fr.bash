#!/bin/bash

# Function to display usage information
usage() {
    echo "Usage: fr [OPTIONS] [DIRECTORY]"
    echo "Generates a YAML representation of the file structure and optionally flattens file contents."
    echo
    echo "Options:"
    echo "  -h, --help     Display this help message"
    echo "  -f, --flatten  Flatten file contents"
    echo
    echo "If DIRECTORY is not specified, the current directory will be used."
}

# Function to check if a file/folder should be ignored
should_ignore() {
    local item=$1
    local base_item=$(basename "$item")

    # Check if the file is fr itself
    if [ "$base_item" = "fr" ]; then
        return 0
    fi

    # Check .gitignore
    if [ -f "$target_dir/.gitignore" ] && grep -qE "^\b$base_item\b" "$target_dir/.gitignore" 2>/dev/null; then
        return 0
    fi

    # Check .flattenignore
    if [ -f "$target_dir/.flattenignore" ] && grep -qE "^\b$base_item\b" "$target_dir/.flattenignore" 2>/dev/null; then
        return 0
    fi

    return 1
}

# Function to generate YAML representation of the file structure
generate_yaml() {
    local folder=$1
    local indent=$2
    local parent_path=$3

    find "$folder" -mindepth 1 -maxdepth 1 ! -path '*/\.*' | while read -r item; do
        local base_item=$(basename "$item")
        local relative_path="$parent_path/$base_item"
        if should_ignore "$item"; then
            continue
        fi
        if [ -d "$item" ]; then
            echo "${indent}- path: $relative_path" >> "$output_file"
            echo "${indent}  type: directory" >> "$output_file"
            echo "${indent}  contents:" >> "$output_file"
            generate_yaml "$item" "  $indent" "$relative_path"
        else
            echo "${indent}- path: $relative_path" >> "$output_file"
            echo "${indent}  type: file" >> "$output_file"
        fi
    done
}

# Function to print file contents
print_file_contents() {
    local file_path=$1
    file_path="${file_path#/}"
    if [ -d "$target_dir/$file_path" ]; then
        echo "Skipping directory: $file_path"
        return
    fi
    if [ ! -f "$target_dir/$file_path" ]; then
        echo "File does not exist: $file_path"
        return
    fi
    if [ "$(basename "$file_path")" = "fr" ]; then
        echo "Skipping fr script"
        return
    fi
    if [[ "$file_path" =~ \.(py|js|ts|jsx|tsx|vue|rb|php|java|go|rs|c|cpp|h|hpp|cs|swift|kt|scala|html|css|scss|less|md|txt|sh|bash|zsh|json|yaml|yml|xml|sql|graphql|r|m|f|f90|jl|lua|pl|pm|t|ps1|bat|asm|s|nim|ex|exs|clj|lisp|hs|erl|elm)$ ]]; then
        echo "<$file_path>" >> "$output_file"
        if cat "$target_dir/$file_path" >> "$output_file"; then
            echo "Successfully wrote contents of $file_path"
        else
            echo "Failed to write contents of $file_path"
        fi
        echo "</$file_path>" >> "$output_file"
        echo "" >> "$output_file"
    else
        echo "Skipping non-text file: $file_path"
    fi
}

# Parse command-line arguments
flatten=false
target_dir="."

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            exit 0
            ;;
        -f|--flatten)
            flatten=true
            shift
            ;;
        *)
            if [ -d "$1" ]; then
                target_dir="$1"
            else
                echo "Error: Invalid directory '$1'"
                usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Create script_result directory
script_result_dir="script_result"
mkdir -p "$script_result_dir"

# Set output file name
dir_name=$(basename "$target_dir")
output_file="$script_result_dir/${dir_name}_output.txt"

# Delete existing file if it exists
rm -f "$output_file"

# Write initial analysis
echo "Analyze the ${dir_name} repository to understand its structure, purpose, and functionality. Follow these steps to study the codebase:" >> "$output_file"
echo "" >> "$output_file"
echo "1. Read the README file to gain an overview of the project, its goals, and any setup instructions." >> "$output_file"
echo "2. Examine the repository structure to understand how the files and directories are organized." >> "$output_file"
echo "3. Identify the main entry point of the application (e.g., main.py, app.py, index.js) and start analyzing the code flow from there." >> "$output_file"
echo "4. Study the dependencies and libraries used in the project to understand the external tools and frameworks being utilized." >> "$output_file"
echo "5. Analyze the core functionality of the project by examining the key modules, classes, and functions." >> "$output_file"
echo "6. Look for any configuration files (e.g., config.py, .env) to understand how the project is configured and what settings are available." >> "$output_file"
echo "7. Investigate any tests or test directories to see how the project ensures code quality and handles different scenarios." >> "$output_file"
echo "8. Review any documentation or inline comments to gather insights into the codebase and its intended behavior." >> "$output_file"
echo "9. Identify any potential areas for improvement, optimization, or further exploration based on your analysis." >> "$output_file"
echo "10. Provide a summary of your findings, including the project's purpose, key features, and any notable observations or recommendations." >> "$output_file"
echo "Use the files and contents provided below to complete this analysis:" >> "$output_file"
echo "" >> "$output_file"

# Generate YAML structure
generate_yaml "$target_dir" "  " ""
echo "" >> "$output_file"

# Append the YAML structure to the output file
cat "$output_file" >> "$output_file"

# Check if flatten flag is set
if $flatten; then
    echo "Flattening repository..."
    while IFS= read -r line || [[ -n "$line" ]]; do
        if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*path:[[:space:]]*(.*) ]]; then
            file_path="${BASH_REMATCH[1]}"
            if [[ ! "$line" =~ type:[[:space:]]*directory ]]; then
                print_file_contents "$file_path"
            fi
        fi
    done < "$output_file"
    echo "Flattened repository content has been created in the same output file."
else
    echo "Repository structure created. Use -f or --flatten flag to also flatten the file contents."
fi
