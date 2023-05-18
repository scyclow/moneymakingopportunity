// SPDX-License-Identifier: MIT
// contract by steviep.eth



import "./Dependencies.sol";
import "hardhat/console.sol";

pragma solidity ^0.8.17;


interface IURI {
  function tokenURI(uint256 tokenId) external view returns (string memory);
}

contract MoneyMakingOpportunity is ERC721, Ownable {
  uint256 private _totalSupply = 1;
  address private uriContract;

  bool public isLocked = true;
  uint256 public startTime;
  uint256 public settlementTime;


  mapping(address => uint256) public addrToTokenId;
  mapping(uint256 => mapping(uint256 => bool)) private _tokenVotes;
  mapping(uint256 => address) public paymentAddressProposals;

  /// @dev This event emits when the metadata of a token is changed.
  /// So that the third-party platforms such as NFT market could
  /// timely update the images and related attributes of the NFT.
  event MetadataUpdate(uint256 _tokenId);

  /// @dev This event emits when the metadata of a range of tokens is changed.
  /// So that the third-party platforms such as NFT market could
  /// timely update the images and related attributes of the NFTs.
  event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

  constructor() ERC721('Money Making Opportunity', 'MMO') {}

  receive() external payable {
    if (isLocked && addrToTokenId[msg.sender] == 0 && msg.value >= 0.03 ether) {
      addrToTokenId[msg.sender] = _totalSupply;
      _totalSupply++;

    } else if (settlementTime > 0) {
      payable(paymentAddressProposals[leaderToken()]) .send(address(this).balance);
    }
  }

  function unlock(address _uriContract) external onlyOwner {
    require(isLocked, '1');
    isLocked = false;
    startTime = block.timestamp;
    setUriContract(_uriContract);
    _mint(msg.sender, 0);
  }

  function mint() external {
    require(!isLocked, '2');
    _mint(msg.sender, addrToTokenId[msg.sender]);
  }

  function castVote(uint256 tokenId, uint256 period, bool vote) external {
    require(ownerOf(tokenId) == msg.sender, '4');
    require(period >= currentPeriod(), '5');
    require(settlementTime == 0, '9');

    _tokenVotes[tokenId][period] = vote;
    emit MetadataUpdate(tokenId);
  }

  // function castVotes(uint256[] calldata tokenIds, uint256 period, bool vote) external {
  //   require(period >= currentPeriod(), '5');
  //   require(settlementTime == 0, '9');

  //   uint len = tokenIds.length;

  //   for (uint256 i; i < len; i++) {
  //     uint256 tokenId = tokenIds[i];
  //     require(ownerOf(tokenId) == msg.sender, '4');
  //     _tokenVotes[tokenId][period] = vote;
  //   }

    // emit BatchMetadataUpdate(0, _totalSupply);
  // }


  function commitPaymentAddressProposal(uint256 tokenId, address paymentAddress) external {
    require(!isEliminated(tokenId), '6');
    require(ownerOf(tokenId) == msg.sender, '4');
    require(paymentAddressProposals[tokenId] == address(0), '7');
    paymentAddressProposals[tokenId] = paymentAddress;
    emit MetadataUpdate(tokenId);
  }


  function settlePayment() external {
    require(settlementTime == 0, '8');

    uint256 currentLeaderToken = currentPeriod();
    (uint256 yays, uint256 nays) = calculateVotes(currentLeaderToken);

    require(yays >= nays, '10');

    settlementTime = block.timestamp;
    payable(paymentAddressProposals[currentLeaderToken]).send(address(this).balance);
  }

  function calculateVotes(uint256 period) public view returns (uint256, uint256) {
    uint256 yays = 1;
    uint256 nays;
    uint256 tokenId = periodToTokenId(period);

    for (uint256 i = 0; i < tokenId; i++) {
      if (_tokenVotes[i][period]) yays++;
      else nays++;
    }

    return (yays, nays);
  }

  function tokenIdToPeriod(uint256 tokenId) public view returns (uint256) {
    return _totalSupply - tokenId;
  }

  function periodToTokenId(uint256 period) public view returns (uint256) {
    if (isLocked) return 0;
    return _totalSupply - period;
  }


  function currentPeriod() public view returns (uint256) {
    if (isLocked) return 0;
    uint256 endTime = settlementTime > 0 ? settlementTime : block.timestamp;
    uint256 period = 1 + (endTime - startTime) / 1 weeks;

    return period >= _totalSupply ? _totalSupply : period;
  }

  function leaderToken() public view returns (uint256) {
    return periodToTokenId(currentPeriod());
  }

  function isEliminated (uint256 tokenId) public view returns (bool) {
    return tokenId > leaderToken();
  }

  function votes(uint256 tokenId, uint256 period) public view returns (bool) {
    return _tokenVotes[tokenId][period];
  }



  function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
    return IURI(uriContract).tokenURI(tokenId);
  }

  function totalSupply() external view returns (uint256) {
    return _totalSupply;
  }

  function exists(uint256 tokenId) external view returns (bool) {
    return _exists(tokenId);
  }

  function setUriContract(address _uriContract) public onlyOwner {
    uriContract = _uriContract;
    emit BatchMetadataUpdate(0, _totalSupply);
  }


  /// @notice Query if a contract implements an interface
  /// @param interfaceId The interface identifier, as specified in ERC-165
  /// @return `true` if the contract implements `interfaceId` and
  ///         `interfaceId` is not 0xffffffff, `false` otherwise
  /// @dev Interface identification is specified in ERC-165. This function
  ///      uses less than 30,000 gas. See: https://eips.ethereum.org/EIPS/eip-165
  ///      See EIP-4906: https://eips.ethereum.org/EIPS/eip-4906
  function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721) returns (bool) {
    return interfaceId == bytes4(0x49064906) || super.supportsInterface(interfaceId);
  }
}
