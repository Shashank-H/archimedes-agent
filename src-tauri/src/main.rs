#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

fn main() {
    gemma_diagram_brainstormer_lib::run()
}
