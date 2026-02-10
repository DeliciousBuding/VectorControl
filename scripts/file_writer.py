def write_to_file(filepath, content):
    """
    Writes the given content to a file at the specified filepath.

    Args:
        filepath (str): The path to the file to write.
        content (str): The content to write into the file.
    """
    try:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"Content successfully written to {filepath}")
    except IOError as e:
        print(f"Error writing to file {filepath}: {e}")

if __name__ == '__main__':
    # Example usage:
    test_file_path = "test_output.txt"
    test_content = "This is a test content written to a file."
    write_to_file(test_file_path, test_content)
    print(f"Check '{test_file_path}' in the current directory to see the output.")

    test_file_path_in_scripts = "another_test_output.txt"
    test_content_in_scripts = "This is another test content."
    write_to_file(test_file_path_in_scripts, test_content_in_scripts)
    print(f"Check '{test_file_path_in_scripts}' in the scripts directory to see the output.")
