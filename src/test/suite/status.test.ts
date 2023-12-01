import * as assert from "assert";

import * as vscode from "vscode";
import { beforeEach, afterEach } from "mocha";
import { State } from "vscode-languageclient/node";

import { Ruby } from "../../ruby";
import {
  RubyVersionStatus,
  ServerStatus,
  ExperimentalFeaturesStatus,
  YjitStatus,
  StatusItem,
  FeaturesStatus,
  FormatterStatus,
} from "../../status";
import { Command, WorkspaceInterface } from "../../common";

suite("StatusItems", () => {
  let ruby: Ruby;
  let status: StatusItem;
  let workspace: WorkspaceInterface;
  let formatter: string;

  afterEach(() => {
    status.dispose();
  });

  suite("RubyVersionStatus", () => {
    beforeEach(() => {
      ruby = { rubyVersion: "3.2.0" } as Ruby;
      workspace = {
        ruby,
        lspClient: {
          state: State.Running,
          formatter: "none",
          serverVersion: "1.0.0",
        },
        error: false,
      };
      status = new RubyVersionStatus();
      status.refresh(workspace);
    });

    test("Status is initialized with the right values", () => {
      assert.strictEqual(status.item.text, "Using Ruby 3.2.0");
      assert.strictEqual(status.item.name, "Ruby LSP Status");
      assert.strictEqual(status.item.command?.title, "Change Ruby version");
      assert.strictEqual(
        status.item.command.command,
        Command.ChangeRubyVersion,
      );
    });

    test("Refresh updates version string", () => {
      assert.strictEqual(status.item.text, "Using Ruby 3.2.0");

      workspace.ruby.rubyVersion = "3.2.1";
      status.refresh(workspace);
      assert.strictEqual(status.item.text, "Using Ruby 3.2.1");
    });
  });

  suite("ServerStatus", () => {
    beforeEach(() => {
      ruby = {} as Ruby;
      workspace = {
        ruby,
        lspClient: {
          state: State.Running,
          formatter: "none",
          serverVersion: "1.0.0",
        },
        error: false,
      };
      status = new ServerStatus();
      status.refresh(workspace);
    });

    test("Refresh when server is starting", () => {
      workspace.lspClient!.state = State.Starting;
      status.refresh(workspace);
      assert.strictEqual(status.item.text, "Ruby LSP: Starting");
      assert.strictEqual(
        status.item.severity,
        vscode.LanguageStatusSeverity.Information,
      );
    });

    test("Refresh when server is running", () => {
      workspace.lspClient!.state = State.Running;
      status.refresh(workspace);
      assert.strictEqual(status.item.text, "Ruby LSP v1.0.0: Running");
      assert.strictEqual(
        status.item.severity,
        vscode.LanguageStatusSeverity.Information,
      );
    });

    test("Refresh when server is stopping", () => {
      workspace.lspClient!.state = State.Stopped;
      status.refresh(workspace);
      assert.strictEqual(status.item.text, "Ruby LSP: Stopped");
      assert.strictEqual(
        status.item.severity,
        vscode.LanguageStatusSeverity.Information,
      );
    });

    test("Refresh when server has errored", () => {
      workspace.error = true;
      status.refresh(workspace);
      assert.strictEqual(status.item.text, "Ruby LSP: Error");
      assert.strictEqual(
        status.item.severity,
        vscode.LanguageStatusSeverity.Error,
      );
    });
  });

  suite("ExperimentalFeaturesStatus", () => {
    beforeEach(() => {
      ruby = {} as Ruby;
      workspace = {
        ruby,
        lspClient: {
          state: State.Running,
          formatter,
          serverVersion: "1.0.0",
        },
        error: false,
      };
      status = new ExperimentalFeaturesStatus();
      status.refresh(workspace);
    });

    test("Status is initialized with the right values", () => {
      assert.match(status.item.text, /Experimental features (dis|en)abled/);
      assert.strictEqual(status.item.name, "Experimental features");
      assert.match(status.item.command?.title!, /Enable|Disable/);
      assert.strictEqual(
        status.item.command!.command,
        Command.ToggleExperimentalFeatures,
      );
    });
  });

  suite("YjitStatus", () => {
    beforeEach(() => {
      ruby = { yjitEnabled: true } as Ruby;
      workspace = {
        ruby,
        lspClient: {
          state: State.Running,
          formatter: "none",
          serverVersion: "1.0.0",
        },
        error: false,
      };
      status = new YjitStatus();
      status.refresh(workspace);
    });

    test("Shows enabled if YJIT is enabled", () => {
      assert.strictEqual(status.item.text, "YJIT enabled");
      assert.strictEqual(status.item.name, "YJIT");
    });

    test("Shows disabled if YJIT is disabled", () => {
      workspace.ruby.yjitEnabled = false;
      status.refresh(workspace);
      assert.strictEqual(status.item.text, "YJIT disabled");
    });
  });

  suite("FeaturesStatus", () => {
    const configuration = vscode.workspace.getConfiguration("rubyLsp");
    const originalFeatures: { [key: string]: boolean } =
      configuration.get("enabledFeatures")!;
    const numberOfExperimentalFeatures = Object.values(originalFeatures).filter(
      (feature) => feature === false,
    ).length;
    const numberOfFeatures = Object.keys(originalFeatures).length;

    beforeEach(() => {
      ruby = {} as Ruby;
      workspace = {
        ruby,
        lspClient: {
          state: State.Running,
          formatter: "none",
          serverVersion: "1.0.0",
        },
        error: false,
      };
      status = new FeaturesStatus();
      status.refresh(workspace);
    });

    afterEach(() => {
      configuration.update("enabledFeatures", originalFeatures, true, true);
    });

    test("Status is initialized with the right values", () => {
      assert.strictEqual(
        status.item.text,
        `${
          numberOfFeatures - numberOfExperimentalFeatures
        }/${numberOfFeatures} features enabled`,
      );
      assert.strictEqual(status.item.name, "Ruby LSP Features");
      assert.strictEqual(status.item.command?.title, "Manage");
      assert.strictEqual(status.item.command.command, Command.ToggleFeatures);
    });

    test("Refresh updates number of features", async () => {
      const originalFeatures = vscode.workspace
        .getConfiguration("rubyLsp")
        .get("enabledFeatures")!;

      await vscode.workspace
        .getConfiguration("rubyLsp")
        .update("enabledFeatures", { completion: false }, true, true);

      const currentFeatures: { [key: string]: boolean } = vscode.workspace
        .getConfiguration("rubyLsp")
        .get("enabledFeatures")!;

      assert.notDeepEqual(currentFeatures, originalFeatures);

      Object.keys(currentFeatures).forEach((key) => {
        const expected = key === "completion" ? false : currentFeatures[key];
        assert.strictEqual(currentFeatures[key], expected);
      });

      status.refresh(workspace);
      assert.strictEqual(
        status.item.text,
        `${
          numberOfFeatures - numberOfExperimentalFeatures - 1
        }/${numberOfFeatures} features enabled`,
      );

      await vscode.workspace
        .getConfiguration("rubyLsp")
        .update("enabledFeatures", originalFeatures, true, true);
    });
  });

  suite("FormatterStatus", () => {
    beforeEach(() => {
      ruby = {} as Ruby;
      workspace = {
        ruby,
        lspClient: {
          state: State.Running,
          formatter: "auto",
          serverVersion: "1.0.0",
        },
        error: false,
      };
      status = new FormatterStatus();
      status.refresh(workspace);
    });

    test("Status is initialized with the right values", () => {
      assert.strictEqual(status.item.text, "Formatter: auto");
      assert.strictEqual(status.item.name, "Formatter");
      assert.strictEqual(status.item.command?.title, "Help");
      assert.strictEqual(status.item.command.command, Command.FormatterHelp);
    });
  });
});
