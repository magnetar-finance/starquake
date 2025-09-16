// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity ^0.8.0;

import 'contracts/core/interfaces/ICLPool.sol';
import './interfaces/ICLGaugeFactory.sol';
import './CLGauge.sol';
import '@openzeppelin/contracts/proxy/Clones.sol';
import '@openzeppelin/contracts/access/Ownable.sol';

contract CLGaugeFactory is ICLGaugeFactory, Ownable {
    /// @inheritdoc ICLGaugeFactory
    address public immutable override voter;
    /// @inheritdoc ICLGaugeFactory
    address public immutable override implementation;
    /// @inheritdoc ICLGaugeFactory
    address public override nft;
    /// @inheritdoc ICLGaugeFactory
    address public override notifyAdmin;

    constructor(address _voter, address _implementation) Ownable(msg.sender) {
        voter = _voter;
        notifyAdmin = msg.sender;
        implementation = _implementation;
    }

    modifier onlyNotifyAdmin() {
        require(notifyAdmin == msg.sender, 'NA');
        _;
    }

    /// @inheritdoc ICLGaugeFactory
    function setNotifyAdmin(address _admin) external override onlyNotifyAdmin() {
        require(_admin != address(0), 'ZA');
        notifyAdmin = _admin;
        emit SetNotifyAdmin(_admin);
    }

    /// @inheritdoc ICLGaugeFactory
    function setNonfungiblePositionManager(address _nft) external override onlyOwner() {
        require(nft == address(0), 'AI');
        require(_nft != address(0), 'ZA');
        nft = _nft;
        _transferOwnership(address(0));
    }

    /// @inheritdoc ICLGaugeFactory
    function createGauge(
        address, /* _forwarder */
        address _pool,
        address _feesVotingReward,
        address _rewardToken,
        bool _isPool
    ) external override returns (address _gauge) {
        require(msg.sender == voter, 'NV');
        address token0 = ICLPool(_pool).token0();
        address token1 = ICLPool(_pool).token1();
        int24 tickSpacing = ICLPool(_pool).tickSpacing();
        bytes32 salt = keccak256(abi.encodePacked(_pool, _rewardToken, _isPool));
        _gauge = Clones.cloneDeterministic(implementation, salt);
        ICLGauge(_gauge).initialize({
            _pool: _pool,
            _feesVotingReward: _feesVotingReward,
            _rewardToken: _rewardToken,
            _voter: voter,
            _nft: nft,
            _token0: token0,
            _token1: token1,
            _tickSpacing: tickSpacing,
            _isPool: _isPool
        });
        ICLPool(_pool).setGaugeAndPositionManager({_gauge: _gauge, _nft: nft});
    }
}
