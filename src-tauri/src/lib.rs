use std::process::Command;
use tauri::Manager;

#[derive(serde::Serialize)]
pub struct RunResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

enum ExecMode {
    Binary(&'static str),
    Interpreter(&'static str, &'static str),
    NotRunnable,
}

fn exec_mode(lang: &str) -> ExecMode {
    match lang {
        "asm"        => ExecMode::Binary("hello_asm"),
        "c"          => ExecMode::Binary("hello_c"),
        "cpp"        => ExecMode::Binary("hello_cpp"),
        "zig"        => ExecMode::Binary("hello_zig"),
        "fortran"    => ExecMode::Binary("hello_fortran"),
        "rust"       => ExecMode::Binary("hello_rust"),
        "go"         => ExecMode::Binary("hello_go"),
        "d"          => ExecMode::Binary("hello_d"),
        "odin"       => ExecMode::Binary("hello_odin"),
        "python"     => ExecMode::Interpreter("python3",  "hello.py"),
        "ruby"       => ExecMode::Interpreter("ruby",     "hello.rb"),
        "lua"        => ExecMode::Interpreter("lua",      "hello.lua"),
        "perl"       => ExecMode::Interpreter("perl",     "hello.pl"),
        "javascript" => ExecMode::Interpreter("node",     "hello.js"),
        "typescript" => ExecMode::Interpreter("ts-node",  "hello.ts"),
        "php"        => ExecMode::Interpreter("php",      "hello.php"),
        "bash"       => ExecMode::Interpreter("bash",     "hello.sh"),
        "r"          => ExecMode::Interpreter("Rscript",  "hello.r"),
        _            => ExecMode::NotRunnable,
    }
}

#[tauri::command]
fn run_hello_world(lang: String, app_handle: tauri::AppHandle) -> Result<RunResult, String> {
    let bin_dir = app_handle
    .path()
    .resource_dir()
    .map_err(|e| e.to_string())?
    .join("binaries");

    let start = std::time::Instant::now();

    let output = match exec_mode(&lang) {
        ExecMode::Binary(name) => {
            let path = bin_dir.join(name);
            Command::new(&path)
            .output()
            .map_err(|e| format!("Failed to run '{}': {}\nRun build-binaries.sh first.", name, e))?
        }
        ExecMode::Interpreter(interp, script) => {
            let script_path = bin_dir.join(script);
            Command::new(interp)
            .arg(&script_path)
            .output()
            .map_err(|e| format!(
                "Failed to launch '{}': {}\nMake sure '{}' is installed and on your PATH.",
                interp, e, interp
            ))?
        }
        ExecMode::NotRunnable => {
            return Err(format!(
                "Language '{}' requires a full build toolchain and cannot be run directly here.",
                lang
            ));
        }
    };

    let duration_ms = start.elapsed().as_millis() as u64;

    Ok(RunResult {
        stdout: String::from_utf8_lossy(&output.stdout).to_string(),
       stderr: String::from_utf8_lossy(&output.stderr).to_string(),
       exit_code: output.status.code().unwrap_or(-1),
       duration_ms,
    })
}

#[tauri::command]
fn get_language_data(_lang: String) -> Result<String, String> {
    Ok("handled_in_frontend".to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
    .invoke_handler(tauri::generate_handler![
        run_hello_world,
        get_language_data
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
